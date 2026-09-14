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
  if (![N, r, p].every(Number.isInteger) || N > 1 << 20 || r > 16 || p > 4) return false;
  const expected = Buffer.from(parts[5], "base64");
  const key = await scryptAsync(password, Buffer.from(parts[4], "base64"), expected.length, {
    N,
    r,
    p,
    maxmem: 256 * N * r,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Семафор на проверки пароля. Занято — сразу отказ, без очереди. */
export class Semaphore {
  private active = 0;
  constructor(private max: number) {}
  tryAcquire(): (() => void) | null {
    if (this.active >= this.max) return null;
    this.active++;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.active--;
      }
    };
  }
}

// Хеш-пустышка для неизвестного email — чтобы время ответа не выдавало, что пользователя нет
let dummyHash: Promise<string> | null = null;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type SessionUser = { id: string; email: string };

export type LoginResult =
  | { ok: true; user: SessionUser & { totp: boolean } }
  | { ok: false; reason: "bad_password" | "need_totp" | "bad_totp" };

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Проверка пароля и второго фактора. Сессию создаёт вызывающий. */
export async function checkCredentials(db: Db, email: string, password: string, totp: string | undefined): Promise<LoginResult> {
  const [user] = await db.query<{ id: string; email: string; password_hash: string; totp_secret: string | null; totp_last_step: number | null }>(
    "select id, email, password_hash, totp_secret, totp_last_step from users where email = $1",
    [normalizeEmail(email)],
  );
  dummyHash ??= hashPassword(randomBytes(12).toString("hex"));
  const ok = await verifyPassword(password, user?.password_hash ?? (await dummyHash));
  if (!user || !ok) return { ok: false, reason: "bad_password" };

  if (user.totp_secret) {
    if (!totp) return { ok: false, reason: "need_totp" };
    const step = verifyTotp(user.totp_secret, totp.trim(), user.totp_last_step);
    if (step === null) return { ok: false, reason: "bad_totp" };
    // Условие в where — защита от гонки: один код не пройдёт в двух параллельных запросах
    const updated = await db.query(
      "update users set totp_last_step = $1 where id = $2 and (totp_last_step is null or totp_last_step < $1) returning id",
      [step, user.id],
    );
    if (updated.length === 0) return { ok: false, reason: "bad_totp" };
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

/** Доверенное ли это устройство для пользователя с этим email. */
export async function isTrustedDevice(db: Db, token: string | undefined, email: string): Promise<boolean> {
  if (!token || token.length > 100) return false;
  const rows = await db.query(
    `update trusted_devices d set last_used_at = now()
     from users u
     where d.id = $1 and u.id = d.user_id and u.email = $2
       and d.last_used_at > now() - interval '${DEVICE_DAYS} days'
     returning d.id`,
    [sha256(token), normalizeEmail(email)],
  );
  return rows.length > 0;
}

export async function logLoginEvent(db: Db, ip: string, email: string, outcome: string): Promise<void> {
  try {
    await db.query("insert into login_events (ip, email, outcome) values ($1, $2, $3)", [
      ip.slice(0, 64),
      normalizeEmail(email).slice(0, EMAIL_MAX),
      outcome,
    ]);
    // Журнал за 90 дней достаточно
    await db.query("delete from login_events where at < now() - interval '90 days'");
  } catch (e) {
    console.error("[auth] журнал входов:", (e as Error).message);
  }
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
  opts: { totpSecret?: string | null } = {},
): Promise<SessionUser & { created: boolean }> {
  const normalized = normalizeEmail(email);
  if (normalized.length > EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Некорректный email");
  if (password.length < PASSWORD_MIN) throw new Error(`Пароль короче ${PASSWORD_MIN} символов`);
  if (password.length > PASSWORD_MAX) throw new Error("Слишком длинный пароль");
  const hash = await hashPassword(password);
  const totp = opts.totpSecret === undefined ? null : opts.totpSecret;
  const [row] = await db.query<SessionUser & { created: boolean }>(
    `insert into users (email, password_hash, totp_secret) values ($1, $2, $3)
     on conflict (email) do update set password_hash = excluded.password_hash,
       totp_secret = case when $4 then excluded.totp_secret else users.totp_secret end,
       totp_last_step = case when $4 then null else users.totp_last_step end
     returning id, email, (xmax = 0) as created`,
    [normalized, hash, totp, opts.totpSecret !== undefined],
  );
  await db.query("delete from sessions where user_id = $1", [row.id]);
  await db.query("delete from trusted_devices where user_id = $1", [row.id]);
  return row;
}

/**
 * Лимит неудачных попыток входа в памяти процесса.
 * Попытка записывается ДО проверки пароля и снимается при успехе — иначе залп
 * параллельных запросов проходит проверку лимита целиком.
 */
export class LoginLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private windowMs = 15 * 60 * 1000,
    private maxKeys = 10_000,
    private now = () => Date.now(),
  ) {}

  private recent(key: string): number[] {
    const since = this.now() - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }

  /** Резерв попытки: null — можно проверять, число — секунд до следующей попытки. */
  reserve(limits: { key: string; max: number }[]): { retryAfter: number } | { release: () => void } {
    let wait = 0;
    for (const { key, max } of limits) {
      const list = this.recent(key);
      if (list.length >= max) wait = Math.max(wait, Math.ceil((list[0] + this.windowMs - this.now()) / 1000));
    }
    if (wait > 0) return { retryAfter: wait };
    const at = this.now();
    for (const { key } of limits) this.hits.set(key, [...this.recent(key), at]);
    this.prune();
    return {
      // Успешный вход снимает свою попытку
      release: () => {
        for (const { key } of limits) {
          const list = this.hits.get(key);
          const i = list?.indexOf(at) ?? -1;
          if (list && i >= 0) list.splice(i, 1);
        }
      },
    };
  }

  /** Сколько ключей в памяти — для тестов. */
  get size(): number {
    return this.hits.size;
  }

  private prune(): void {
    if (this.hits.size <= this.maxKeys) return;
    const since = this.now() - this.windowMs;
    for (const [key, list] of this.hits) {
      if (list[list.length - 1] <= since) this.hits.delete(key);
    }
    // Всё ещё много — выкидываем самые старые ключи (Map хранит порядок вставки)
    for (const key of this.hits.keys()) {
      if (this.hits.size <= this.maxKeys) break;
      this.hits.delete(key);
    }
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
