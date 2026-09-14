/**
 * Вход в админку: пароль, второй фактор, сессия, лимиты.
 *
 * - Пароль — scrypt с солью; параметры хранятся в строке хеша, их можно поднять
 *   позже без смены формата.
 * - Второй фактор — TOTP (totp.ts), если включён у пользователя.
 * - Сессия — случайный токен в httpOnly-cookie; в базе только SHA-256.
 *   Срок — 14 дней, и не дольше 72 часов простоя.
 * - Неизвестный email проверяется так же долго, как известный.
 * - Параллельных проверок пароля не больше двух: scrypt занимает поток пула
 *   libuv и 32 МБ памяти, поток попыток входа не должен положить сервер.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Db } from "../db/db";
import { verifyTotp } from "./totp";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;

// N=2^15: 32 МБ на проверку. OWASP советует 2^17 (128 МБ) — это не влезает в
// контейнер на 256 МБ при двух параллельных входах. Параметры записаны в хеш.
const SCRYPT_DEFAULT = { N: 32768, r: 8, p: 1 };
const KEYLEN = 64;

export const SESSION_DAYS = 14;
export const SESSION_IDLE_HOURS = 72;
export const DEVICE_DAYS = 180;
export const PASSWORD_MIN = 12;
export const EMAIL_MAX = 254;
export const PASSWORD_MAX = 1000;

/** Имя cookie. С HTTPS — префикс __Host-: её нельзя подсунуть с поддомена. */
export const sessionCookieName = (secure: boolean) => (secure ? "__Host-webik_session" : "webik_session");
export const deviceCookieName = (secure: boolean) => (secure ? "__Host-webik_device" : "webik_device");

export async function hashPassword(password: string, params = SCRYPT_DEFAULT): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEYLEN, { ...params, maxmem: 256 * params.N * params.r });
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts[0] !== "scrypt" || parts.length !== 6) return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  // Потолок: хеш из базы не должен заставить процесс выделить гигабайты
  if (![N, r, p].every(Number.isInteger) || N < 2 || N > 1 << 17 || r > 8 || p > 2) return false;
  const expected = Buffer.from(parts[5], "base64");
  const key = await scryptAsync(password, Buffer.from(parts[4], "base64"), expected.length, {
    N,
    r,
    p,
    maxmem: 256 * N * r,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/**
 * Семафор на проверки пароля с короткой очередью: занято дольше waitMs — отказ.
 * Очередь ограничена, чтобы висящие запросы не копились в памяти.
 */
export class Semaphore {
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(
    private max: number,
    private maxQueue = 4,
  ) {}

  private makeRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.queue.shift();
      if (next) next();
      else this.active--;
    };
  }

  tryAcquire(): (() => void) | null {
    if (this.active >= this.max) return null;
    this.active++;
    return this.makeRelease();
  }

  async acquire(waitMs: number): Promise<(() => void) | null> {
    const now = this.tryAcquire();
    if (now || waitMs <= 0 || this.queue.length >= this.maxQueue) return now;
    return new Promise((resolve) => {
      const grant = () => {
        clearTimeout(timer);
        resolve(this.makeRelease());
      };
      const timer = setTimeout(() => {
        const idx = this.queue.indexOf(grant);
        if (idx >= 0) this.queue.splice(idx, 1);
        resolve(null);
      }, waitMs);
      this.queue.push(grant);
    });
  }
}

// Хеш-пустышка для неизвестного email — чтобы время ответа не выдавало, что пользователя нет
let dummyHash: Promise<string> | null = null;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type SessionUser = { id: string; email: string };

export type LoginResult =
  | { ok: true; user: SessionUser & { totp: boolean } }
  | { ok: false; reason: "bad_password" | "bad_totp" | "totp_locked" };

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const TOTP_MAX_FAILURES = 5;
export const TOTP_LOCK_MINUTES = 15;

/**
 * Проверка пароля и второго фактора. Сессию создаёт вызывающий.
 * Наружу все неудачи отдаются одним ответом (см. app.ts) — иначе пароль можно
 * подобрать отдельно от кода. Неудачи кода считаются в базе: 5 подряд — код
 * не принимается 15 минут, даже верный.
 */
export async function checkCredentials(db: Db, email: string, password: string, totp: string | undefined): Promise<LoginResult> {
  const [user] = await db.query<{
    id: string;
    email: string;
    password_hash: string;
    totp_secret: string | null;
    totp_last_step: number | null;
    totp_locked: boolean;
  }>(
    `select id, email, password_hash, totp_secret, totp_last_step,
            coalesce(totp_locked_until > now(), false) as totp_locked
     from users where email = $1`,
    [normalizeEmail(email)],
  );
  dummyHash ??= hashPassword(randomBytes(12).toString("hex"));
  const ok = await verifyPassword(password, user?.password_hash ?? (await dummyHash));
  if (!user || !ok) return { ok: false, reason: "bad_password" };

  if (user.totp_secret) {
    if (user.totp_locked) return { ok: false, reason: "totp_locked" };
    const step = totp ? verifyTotp(user.totp_secret, totp.trim(), user.totp_last_step) : null;
    // Условие в where — защита от гонки: один код не пройдёт в двух параллельных запросах
    const accepted =
      step !== null &&
      (
        await db.query(
          `update users set totp_last_step = $1, totp_failures = 0, totp_locked_until = null
           where id = $2 and (totp_last_step is null or totp_last_step < $1) returning id`,
          [step, user.id],
        )
      ).length > 0;
    if (!accepted) {
      // Пустой код тоже неудача: иначе «пароль верный, код не прислан» отличим по счётчику
      await db.query(
        `update users set
           totp_locked_until = case when totp_failures + 1 >= $2 then now() + interval '${TOTP_LOCK_MINUTES} minutes' else totp_locked_until end,
           totp_failures = case when totp_failures + 1 >= $2 then 0 else totp_failures + 1 end
         where id = $1`,
        [user.id, TOTP_MAX_FAILURES],
      );
      return { ok: false, reason: "bad_totp" };
    }
  }
  return { ok: true, user: { id: user.id, email: user.email, totp: !!user.totp_secret } };
}

/** Новая сессия: токен уходит в cookie, в базу — только его хеш. */
export async function createSession(db: Db, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    `insert into sessions (id, user_id, expires_at) values ($1, $2, now() + interval '${SESSION_DAYS} days')`,
    [sha256(token), userId],
  );
  // Заодно чистим протухшие сессии этого пользователя
  await db.query(
    `delete from sessions where user_id = $1 and (expires_at < now() or last_seen_at < now() - interval '${SESSION_IDLE_HOURS} hours')`,
    [userId],
  );
  return token;
}

export async function sessionUser(db: Db, token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  // Проверка и продление простоя — одним запросом
  const [row] = await db.query<SessionUser>(
    `update sessions s set last_seen_at = now()
     from users u
     where s.id = $1 and u.id = s.user_id and s.expires_at > now()
       and s.last_seen_at > now() - interval '${SESSION_IDLE_HOURS} hours'
     returning u.id, u.email`,
    [sha256(token)],
  );
  return row ?? null;
}

export async function deleteSession(db: Db, token: string | undefined): Promise<void> {
  if (token && token.length <= 100) await db.query("delete from sessions where id = $1", [sha256(token)]);
}

export async function createTrustedDevice(db: Db, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query("insert into trusted_devices (id, user_id) values ($1, $2)", [sha256(token), userId]);
  await db.query(`delete from trusted_devices where user_id = $1 and last_used_at < now() - interval '${DEVICE_DAYS} days'`, [userId]);
  return token;
}

/** Доверенное ли это устройство для пользователя с этим email. Только чтение. */
export async function isTrustedDevice(db: Db, token: string | undefined, email: string): Promise<boolean> {
  if (!token || token.length > 100) return false;
  const rows = await db.query(
    `select 1 from trusted_devices d join users u on u.id = d.user_id
     where d.id = $1 and u.email = $2 and d.last_used_at > now() - interval '${DEVICE_DAYS} days'`,
    [sha256(token), normalizeEmail(email).slice(0, EMAIL_MAX)],
  );
  return rows.length > 0;
}

export async function touchTrustedDevice(db: Db, token: string | undefined): Promise<void> {
  if (token && token.length <= 100) {
    await db.query("update trusted_devices set last_used_at = now() where id = $1", [sha256(token)]);
  }
}

/** Существует ли пользователь — счётчик по email ведётся только для настоящих адресов. */
export async function userExists(db: Db, email: string): Promise<boolean> {
  const rows = await db.query("select 1 from users where email = $1", [normalizeEmail(email).slice(0, EMAIL_MAX)]);
  return rows.length > 0;
}

/**
 * Запись в журнал входов. Пишутся только исходы настоящих проверок — их не больше
 * лимита на адрес. Отказы по лимиту и «сервер занят» считаются в памяти
 * (LoginStats), иначе заблокированный адрес мог бы бесконечно писать в базу.
 */
export async function logLoginEvent(db: Db, ip: string, email: string, outcome: string): Promise<void> {
  const normalized = normalizeEmail(email);
  // Если в поле email по ошибке ввели пароль — в журнал он не попадёт
  const safeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized.slice(0, EMAIL_MAX) : "(не email)";
  try {
    await db.query("insert into login_events (ip, email, outcome) values ($1, $2, $3)", [ip.slice(0, 64), safeEmail, outcome]);
  } catch (e) {
    console.error("[auth] журнал входов:", (e as Error).message);
  }
}

export async function pruneLoginEvents(db: Db): Promise<void> {
  await db.query("delete from login_events where at < now() - interval '90 days'");
}

/**
 * Создать пользователя или сменить пароль существующему (created — что именно).
 * Смена пароля сбрасывает все сессии и доверенные устройства.
 * Только для CLI — никогда не вызывать из HTTP-маршрута.
 */
export async function createUser(
  db: Db,
  email: string,
  password: string,
  opts: { totpSecret?: string | null; totpStep?: number | null } = {},
): Promise<SessionUser & { created: boolean }> {
  const normalized = normalizeEmail(email);
  if (normalized.length > EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Некорректный email");
  if (password.length < PASSWORD_MIN) throw new Error(`Пароль короче ${PASSWORD_MIN} символов`);
  if (password.length > PASSWORD_MAX) throw new Error("Слишком длинный пароль");
  const hash = await hashPassword(password);
  const totp = opts.totpSecret === undefined ? null : opts.totpSecret;
  // Шаг кода, проверенного при включении, сразу считается использованным
  const [row] = await db.query<SessionUser & { created: boolean }>(
    `insert into users (email, password_hash, totp_secret, totp_last_step) values ($1, $2, $3, $5)
     on conflict (email) do update set password_hash = excluded.password_hash,
       totp_secret = case when $4 then excluded.totp_secret else users.totp_secret end,
       totp_last_step = case when $4 then excluded.totp_last_step else users.totp_last_step end,
       totp_failures = 0, totp_locked_until = null
     returning id, email, (xmax = 0) as created`,
    [normalized, hash, totp, opts.totpSecret !== undefined, opts.totpStep ?? null],
  );
  await db.query("delete from sessions where user_id = $1", [row.id]);
  await db.query("delete from trusted_devices where user_id = $1", [row.id]);
  return row;
}

/**
 * Лимит неудачных попыток входа в памяти процесса.
 * Попытка записывается ДО проверки пароля и снимается при успехе — иначе залп
 * параллельных запросов проходит проверку лимита целиком.
 *
 * Потолок ключей закрыт наглухо: при переполнении удаляются только истёкшие
 * ключи, а если места всё равно нет — новый ключ получает отказ. Действующие
 * блокировки не вытесняются никогда, иначе флуд уникальными ключами их сбрасывал бы.
 */
export class LoginLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private windowMs = 15 * 60 * 1000,
    private maxKeys = 50_000,
    private now = () => Date.now(),
  ) {}

  private recent(key: string): number[] {
    const since = this.now() - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }

  /** Резерв попытки: { release } — можно проверять, { retryAfter } — отказ. */
  reserve(limits: { key: string; max: number }[]): { retryAfter: number } | { release: () => void } {
    let wait = 0;
    for (const { key, max } of limits) {
      const list = this.recent(key);
      if (list.length >= max) wait = Math.max(wait, Math.ceil((list[0] + this.windowMs - this.now()) / 1000));
    }
    if (wait > 0) return { retryAfter: wait };

    const newKeys = limits.filter(({ key }) => !this.hits.has(key)).length;
    if (this.hits.size + newKeys > this.maxKeys) {
      this.dropExpired();
      if (this.hits.size + newKeys > this.maxKeys) return { retryAfter: 60 };
    }

    const at = this.now();
    for (const { key } of limits) this.hits.set(key, [...this.recent(key), at]);
    return {
      // Успешный вход снимает свою попытку
      release: () => {
        for (const { key } of limits) {
          const list = this.hits.get(key);
          const i = list?.indexOf(at) ?? -1;
          if (list && i >= 0) list.splice(i, 1);
          if (list && list.length === 0) this.hits.delete(key);
        }
      },
    };
  }

  /** Сколько ключей в памяти — для тестов. */
  get size(): number {
    return this.hits.size;
  }

  private dropExpired(): void {
    const since = this.now() - this.windowMs;
    for (const [key, list] of this.hits) {
      if (list[list.length - 1] <= since) this.hits.delete(key);
    }
  }
}

/** Отказы по лимиту и «занято» — счётчики в памяти, в лог раз в минуту одной строкой. */
export class LoginStats {
  private counts = new Map<string, number>();
  add(outcome: string): void {
    this.counts.set(outcome, (this.counts.get(outcome) ?? 0) + 1);
  }
  flush(): string | null {
    if (this.counts.size === 0) return null;
    const line = [...this.counts].map(([k, v]) => `${k}=${v}`).join(" ");
    this.counts.clear();
    return line;
  }
}

/** IPv6 сводим к /64: у одного клиента их миллиарды, лимит на адрес иначе не работает. */
export function limiterIpKey(ip: string): string {
  const v4 = ip.replace(/^::ffff:/, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4;
  if (!ip.includes(":")) return ip;
  const [head, tail] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const groups = tail !== undefined ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  return `${groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")).join(":")}::/64`;
}
