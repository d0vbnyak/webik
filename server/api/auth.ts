/**
 * Вход в админку: пароль, сессия, лимит попыток.
 *
 * - Пароль хранится как scrypt-хеш с солью (node:crypto, без сторонних пакетов).
 * - Сессия — случайный токен в httpOnly-cookie; в базе лежит только его SHA-256.
 * - Неизвестный email проверяется так же долго, как известный: по времени ответа
 *   нельзя узнать, есть ли такой пользователь.
 * - Лимит: 5 неудачных попыток за 15 минут на адрес и на email.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Db } from "../db/db";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

export const SESSION_COOKIE = "webik_session";
export const SESSION_DAYS = 30;
export const PASSWORD_MIN = 12;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEYLEN, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length, SCRYPT);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Хеш-пустышка для неизвестного email — чтобы время ответа не выдавало, что пользователя нет
let dummyHash: Promise<string> | null = null;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type SessionUser = { id: string; email: string };

export async function login(
  db: Db,
  email: string,
  password: string,
): Promise<{ token: string; user: SessionUser } | null> {
  const normalized = email.trim().toLowerCase();
  const [user] = await db.query<{ id: string; email: string; password_hash: string }>(
    "select id, email, password_hash from users where email = $1",
    [normalized],
  );
  dummyHash ??= hashPassword(randomBytes(12).toString("hex"));
  const ok = await verifyPassword(password, user?.password_hash ?? (await dummyHash));
  if (!user || !ok) return null;
  return { token: await createSession(db, user.id), user: { id: user.id, email: user.email } };
}

/** Новая сессия: токен уходит в cookie, в базу — только его хеш. */
export async function createSession(db: Db, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    `insert into sessions (id, user_id, expires_at) values ($1, $2, now() + interval '${SESSION_DAYS} days')`,
    [sha256(token), userId],
  );
  // Заодно чистим протухшие сессии этого пользователя
  await db.query("delete from sessions where user_id = $1 and expires_at < now()", [userId]);
  return token;
}

export async function sessionUser(db: Db, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [row] = await db.query<SessionUser>(
    `select u.id, u.email from sessions s join users u on u.id = s.user_id
     where s.id = $1 and s.expires_at > now()`,
    [sha256(token)],
  );
  return row ?? null;
}

export async function logout(db: Db, token: string | undefined): Promise<void> {
  if (token) await db.query("delete from sessions where id = $1", [sha256(token)]);
}

export async function createUser(db: Db, email: string, password: string): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Некорректный email");
  if (password.length < PASSWORD_MIN) throw new Error(`Пароль короче ${PASSWORD_MIN} символов`);
  const [row] = await db.query<SessionUser>(
    `insert into users (email, password_hash) values ($1, $2)
     on conflict (email) do update set password_hash = excluded.password_hash
     returning id, email`,
    [normalized, await hashPassword(password)],
  );
  // Смена пароля выкидывает все старые сессии
  await db.query("delete from sessions where user_id = $1", [row.id]);
  return row;
}

/** Лимит неудачных попыток входа. В памяти процесса: на одного админа этого достаточно. */
export class LoginLimiter {
  private fails = new Map<string, number[]>();
  constructor(
    private max = 5,
    private windowMs = 15 * 60 * 1000,
    private now = () => Date.now(),
  ) {}

  private recent(key: string): number[] {
    const since = this.now() - this.windowMs;
    const list = (this.fails.get(key) ?? []).filter((t) => t > since);
    if (list.length) this.fails.set(key, list);
    else this.fails.delete(key);
    return list;
  }

  /** Сколько секунд ждать, или 0 — можно пробовать. */
  retryAfter(keys: string[]): number {
    let wait = 0;
    for (const key of keys) {
      const list = this.recent(key);
      if (list.length >= this.max) wait = Math.max(wait, Math.ceil((list[0] + this.windowMs - this.now()) / 1000));
    }
    return wait;
  }

  fail(keys: string[]): void {
    for (const key of keys) this.fails.set(key, [...this.recent(key), this.now()]);
  }

  reset(keys: string[]): void {
    keys.forEach((k) => this.fails.delete(k));
  }
}
