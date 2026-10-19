// Интеграционные тесты API на настоящем Postgres (PGlite в памяти).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, hasTransactionControl, migrate, parseTimestamp, type Db } from "../db/db";
import { createApp } from "./app";
import type { OrderNotifier, OrderSaver } from "../orders";
import { LoginLimiter, Semaphore, createUser, hashPassword, isTokenFormat, limiterIpKey, verifyPassword } from "./auth";
import { buildQuery, QueryError, validateRequest } from "./query";
import { OpenerError } from "../ai/opener";
import { base32Decode, base32Encode, generateTotpSecret, totpCode, verifyTotp } from "./totp";

let db: Db;
let app: ReturnType<typeof createApp>;
let limiter: LoginLimiter;
let ip = "1.2.3.4";

const PASS = "correct horse battery";
const json = (r: Response): Promise<any> => r.json(); // eslint-disable-line @typescript-eslint/no-explicit-any

beforeAll(async () => {
  db = await createPgliteDb();
  expect(await migrate(db)).toEqual(["001_init.sql", "002_auth_hardening.sql", "003_totp_lock.sql", "004_tax_deduction.sql", "005_tax_constraints.sql", "006_projects.sql"]);
  expect(await migrate(db)).toEqual([]); // повторный прогон ничего не делает
  await createUser(db, "Sergey@Example.com", PASS);
  await createUser(db, "other@example.com", PASS);
}, 60_000);

afterAll(async () => {
  await db.close();
});

beforeEach(() => {
  ip = "1.2.3.4";
  limiter = new LoginLimiter();
  app = createApp({ db, secureCookies: false, clientIp: () => ip, limiter });
});

const post = (path: string, body: unknown, cookie?: string, csrf = true) =>
  app.request(`/api${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(csrf ? { "x-webik": "1" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

/** Все cookie из ответа в виде «имя=значение; имя=значение». */
const cookiesOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

async function signIn(email: string, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await post("/auth/login", { email, password: PASS, ...extra });
  expect(res.status).toBe(200);
  const raw = res.headers.getSetCookie().join("\n");
  expect(raw).toContain("HttpOnly");
  expect(raw).toContain("SameSite=Strict");
  return cookiesOf(res);
}

const sessionOnly = (cookies: string) => cookies.split("; ").find((c) => c.startsWith("webik_session="))!;

describe("вход", () => {
  it("правильный пароль → cookie сессии и устройства; email без учёта регистра", async () => {
    const cookie = await signIn("sergey@example.com");
    expect(cookie).toMatch(/webik_session=.+; webik_device=.+/);
    const res = await app.request("/api/auth/session", { headers: { cookie } });
    expect(await json(res)).toMatchObject({ user: { email: "sergey@example.com" } });
  });

  it("неверный пароль и неизвестный email — одинаковый ответ 401, событие в журнале", async () => {
    const a = await post("/auth/login", { email: "sergey@example.com", password: "wrong password!" });
    const b = await post("/auth/login", { email: "nobody@example.com", password: "wrong password!" });
    expect(a.status).toBe(401);
    expect(await json(a)).toEqual({ error: "Неверный email, пароль или код" });
    expect(await json(b)).toEqual({ error: "Неверный email, пароль или код" });
    const [last] = await db.query<{ outcome: string; ip: string }>("select outcome, ip from login_events order by id desc limit 1");
    expect(last).toEqual({ outcome: "bad_password", ip: "1.2.3.4" });
  });

  it("после 5 неудач с адреса — 429 даже с верным паролем", async () => {
    for (let i = 0; i < 5; i++) await post("/auth/login", { email: "sergey@example.com", password: "nope nope nope" });
    const res = await post("/auth/login", { email: "sergey@example.com", password: PASS });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  it("H1: залп параллельных попыток не обходит лимит", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => post("/auth/login", { email: "sergey@example.com", password: "nope nope nope" })),
    );
    const statuses = results.map((r) => r.status);
    // Проверок пароля — не больше лимита адреса, остальные сразу 429
    expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(5);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(15);
  });

  it("M4/N1: «сервер занят» — 429 без проверки, без штрафа и без ключей в лимитере", async () => {
    const busyApp = createApp({ db, secureCookies: false, clientIp: () => ip, limiter, passwordChecks: new Semaphore(0), passwordWaitMs: 0 });
    for (let i = 0; i < 50; i++) {
      const res = await busyApp.request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-webik": "1" },
        body: JSON.stringify({ email: `junk${i}@x.ru`, password: PASS }),
      });
      expect(res.status).toBe(429);
    }
    expect(limiter.size).toBe(0);
    expect((await post("/auth/login", { email: "sergey@example.com", password: PASS })).status).toBe(200);
  });

  it("R1: заблокированный адрес не занимает очередь проверок пароля", async () => {
    const checks = new Semaphore(1, 0);
    const busyApp = createApp({ db, secureCookies: false, clientIp: () => ip, limiter, passwordChecks: checks, passwordWaitMs: 0 });
    const send = (email: string, password: string) =>
      busyApp.request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-webik": "1" },
        body: JSON.stringify({ email, password }),
      });
    ip = "7.7.7.7";
    for (let i = 0; i < 5; i++) await send("sergey@example.com", "nope nope nope");
    const hold = checks.tryAcquire(); // если бы заблокированный адрес брал слот — его бы не было
    expect(hold).not.toBeNull();
    hold!();
    const flood = await Promise.all(Array.from({ length: 50 }, () => send("sergey@example.com", "nope nope nope")));
    expect(flood.every((r) => r.status === 429)).toBe(true);
    ip = "8.8.8.8";
    expect((await send("sergey@example.com", PASS)).status).toBe(200);
  });

  it("R1: мусорные cookie сессии отсекаются без запроса к базе", async () => {
    expect(isTokenFormat("a".repeat(43))).toBe(true);
    expect(isTokenFormat("a".repeat(42))).toBe(false);
    expect(isTokenFormat('"quoted"')).toBe(false);
    const res = await post("/db", { table: "leads", action: "select" }, "webik_session=x; webik_session=y");
    expect(res.status).toBe(401);
  });

  it("N1: мусорные email не создают ключей в лимитере — только адрес", async () => {
    for (let i = 0; i < 4; i++) await post("/auth/login", { email: `junk${i}@x.ru`, password: "nope nope nope" });
    expect(limiter.size).toBe(1);
  });

  it("N2: отказы по лимиту не пишутся в журнал построчно", async () => {
    const [{ n: before }] = await db.query<{ n: number }>("select count(*)::int as n from login_events");
    for (let i = 0; i < 30; i++) await post("/auth/login", { email: "sergey@example.com", password: "nope nope nope" });
    const [{ n: after }] = await db.query<{ n: number }>("select count(*)::int as n from login_events");
    expect(after - before).toBe(5); // только настоящие проверки пароля
  });

  it("M3: перебор к email админа с чужих адресов не запирает его доверенный браузер", async () => {
    const adminCookies = await signIn("sergey@example.com"); // браузер стал доверенным
    const device = adminCookies.split("; ").find((c) => c.startsWith("webik_device="))!;
    for (let i = 0; i < 12; i++) {
      ip = `9.9.9.${i}`;
      await post("/auth/login", { email: " SERGEY@example.com ", password: "nope nope nope" });
    }
    ip = "5.5.5.5";
    expect((await post("/auth/login", { email: "sergey@example.com", password: PASS })).status).toBe(429); // новый браузер — заперт
    expect((await post("/auth/login", { email: "sergey@example.com", password: PASS }, device)).status).toBe(200); // свой — нет
  });

  it("M1: тело больше 8 КБ на входе отклоняется, даже без Content-Length", async () => {
    const big = "x".repeat(20_000);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ email: "a@b.c", password: big })));
        controller.close();
      },
    });
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-webik": "1" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(res.status).toBe(413);
  });

  it("M2: слишком длинный email не проверяется", async () => {
    const res = await post("/auth/login", { email: `${"a".repeat(300)}@x.ru`, password: PASS });
    expect(res.status).toBe(400);
  });

  it("выход удаляет сессию; повторный вход удаляет старую сессию браузера", async () => {
    const first = await signIn("sergey@example.com");
    const again = await post("/auth/login", { email: "sergey@example.com", password: PASS }, first);
    expect(again.status).toBe(200);
    expect((await post("/db", { table: "leads", action: "select" }, sessionOnly(first))).status).toBe(401);

    const cookie = cookiesOf(again);
    await post("/auth/logout", {}, cookie);
    expect((await post("/db", { table: "leads", action: "select" }, cookie)).status).toBe(401);
  });

  it("сессия не действует после 72 часов простоя", async () => {
    const cookie = await signIn("other@example.com");
    expect((await post("/db", { table: "leads", action: "select" }, cookie)).status).toBe(200);
    await db.query("update sessions set last_seen_at = now() - interval '73 hours'");
    expect((await post("/db", { table: "leads", action: "select" }, cookie)).status).toBe(401);
  });

  it("несколько cookie сессии (старая с другим Path) — работает действующая", async () => {
    const cookie = sessionOnly(await signIn("sergey@example.com"));
    const res = await post("/db", { table: "leads", action: "select" }, `webik_session=stale-token; ${cookie}`);
    expect(res.status).toBe(200);
  });

  it("POST без заголовка X-WebIK отклоняется (CSRF)", async () => {
    const res = await post("/auth/login", { email: "sergey@example.com", password: PASS }, undefined, false);
    expect(res.status).toBe(403);
  });

  it("смена пароля выкидывает старые сессии; created различает создание и смену", async () => {
    const cookie = await signIn("other@example.com");
    const changed = await createUser(db, "other@example.com", PASS);
    expect(changed.created).toBe(false);
    expect((await post("/db", { table: "leads", action: "select" }, cookie)).status).toBe(401);
    expect((await createUser(db, "new-admin@example.com", PASS)).created).toBe(true);
  });

  it("scrypt: параметры в хеше, соль разная, мусор не проходит", async () => {
    const h1 = await hashPassword("secret password");
    const h2 = await hashPassword("secret password");
    expect(h1).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(h1).not.toBe(h2);
    expect(await verifyPassword("secret password", h1)).toBe(true);
    expect(await verifyPassword("Secret password", h1)).toBe(false);
    expect(await verifyPassword("x", "мусор")).toBe(false);
    expect(await verifyPassword("x", "scrypt$99999999$8$1$AA==$AA==")).toBe(false); // N-бомба
  });

  it("короткий пароль не создаётся", async () => {
    await expect(createUser(db, "short@example.com", "123")).rejects.toThrow("короче");
  });
});

describe("второй фактор (TOTP)", () => {
  it("RFC 6238: эталонный вектор SHA-1", () => {
    // Секрет «12345678901234567890», T=59 с → 94287082 (8 цифр) → 287082 (6 цифр)
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(totpCode(secret, Math.floor(59 / 30))).toBe("287082");
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
  });

  it("N5: без кода, с неверным кодом и с неверным паролем — один и тот же ответ", async () => {
    const secret = generateTotpSecret();
    await createUser(db, "totp@example.com", PASS, { totpSecret: secret });
    const expected = { error: "Неверный email, пароль или код" };

    const noCode = await post("/auth/login", { email: "totp@example.com", password: PASS });
    const badCode = await post("/auth/login", { email: "totp@example.com", password: PASS, totp: "000000" });
    const badPass = await post("/auth/login", { email: "totp@example.com", password: "wrong wrong wrong", totp: "000000" });
    for (const r of [noCode, badCode, badPass]) {
      expect(r.status).toBe(401);
      expect(await json(r)).toEqual(expected);
    }

    const code = totpCode(secret, Math.floor(Date.now() / 30_000));
    expect((await post("/auth/login", { email: "totp@example.com", password: PASS, totp: code })).status).toBe(200);
    // Повтор того же кода
    ip = "2.2.2.2";
    expect((await post("/auth/login", { email: "totp@example.com", password: PASS, totp: code })).status).toBe(401);
  });

  it("код с неверным паролем не принимается и не сжигается", async () => {
    const secret = generateTotpSecret();
    await createUser(db, "totp2@example.com", PASS, { totpSecret: secret });
    const code = totpCode(secret, Math.floor(Date.now() / 30_000));
    expect((await post("/auth/login", { email: "totp2@example.com", password: "wrong wrong wrong", totp: code })).status).toBe(401);
    expect((await post("/auth/login", { email: "totp2@example.com", password: PASS, totp: code })).status).toBe(200);
  });

  it("N1: 5 неверных кодов — блокировка в базе, даже верный код не проходит", async () => {
    const secret = generateTotpSecret();
    await createUser(db, "totp3@example.com", PASS, { totpSecret: secret });
    for (let i = 0; i < 5; i++) {
      ip = `3.3.3.${i}`; // с разных адресов, чтобы не упереться в лимит адреса
      await post("/auth/login", { email: "totp3@example.com", password: PASS, totp: "111111" });
    }
    ip = "4.4.4.4";
    limiter = new LoginLimiter(); // «перезапуск сервера» — счётчик кода в базе не сбрасывается
    app = createApp({ db, secureCookies: false, clientIp: () => ip, limiter });
    const code = totpCode(secret, Math.floor(Date.now() / 30_000));
    const res = await post("/auth/login", { email: "totp3@example.com", password: PASS, totp: code });
    expect(res.status).toBe(401);
    expect(await json(res)).toEqual({ error: "Неверный email, пароль или код" });
    await db.query("update users set totp_locked_until = now() - interval '1 second' where email = 'totp3@example.com'");
    expect((await post("/auth/login", { email: "totp3@example.com", password: PASS, totp: code })).status).toBe(200);
  });

  it("R2: блокировка кода не запирает доверенный браузер", async () => {
    const secret = generateTotpSecret();
    await createUser(db, "totp5@example.com", PASS, { totpSecret: secret });
    const ok = await post("/auth/login", { email: "totp5@example.com", password: PASS, totp: totpCode(secret, Math.floor(Date.now() / 30_000)) });
    const device = cookiesOf(ok).split("; ").find((c) => c.startsWith("webik_device="))!;
    await db.query("update users set totp_locked_until = now() + interval '15 minutes' where email = 'totp5@example.com'");
    ip = "6.6.6.6";
    const next = totpCode(secret, Math.floor(Date.now() / 30_000) + 1);
    expect((await post("/auth/login", { email: "totp5@example.com", password: PASS, totp: next })).status).toBe(401); // новый браузер — нет
    expect((await post("/auth/login", { email: "totp5@example.com", password: PASS, totp: next }, device)).status).toBe(200); // свой — да
  });

  it("N6: код, проверенный при включении, повторно не проходит", async () => {
    const secret = generateTotpSecret();
    const step = Math.floor(Date.now() / 30_000);
    await createUser(db, "totp4@example.com", PASS, { totpSecret: secret, totpStep: step });
    expect((await post("/auth/login", { email: "totp4@example.com", password: PASS, totp: totpCode(secret, step) })).status).toBe(401);
  });

  it("допуск ±1 шаг, дальше — нет", () => {
    const secret = generateTotpSecret();
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(secret, totpCode(secret, step - 1), null, now)).toBe(step - 1);
    expect(verifyTotp(secret, totpCode(secret, step + 1), null, now)).toBe(step + 1);
    expect(verifyTotp(secret, totpCode(secret, step - 2), null, now)).toBeNull();
    expect(verifyTotp(secret, "12345", null, now)).toBeNull();
  });
});

describe("LoginLimiter", () => {
  it("N1: при переполнении действующие блокировки не вытесняются, новый ключ — отказ", () => {
    let now = 0;
    const l = new LoginLimiter(1000, 100, () => now);
    for (let i = 0; i < 5; i++) l.reserve([{ key: "ip:attacker", max: 5 }]);
    for (let i = 0; i < 99; i++) l.reserve([{ key: `junk${i}`, max: 5 }]);
    expect("retryAfter" in l.reserve([{ key: "new-key", max: 5 }])).toBe(true); // места нет — отказ
    expect("retryAfter" in l.reserve([{ key: "ip:attacker", max: 5 }])).toBe(true); // блок на месте
    now = 5000; // окно истекло — место освобождается
    expect("release" in l.reserve([{ key: "new-key", max: 5 }])).toBe(true);
  });

  it("release снимает только свою попытку", () => {
    const l = new LoginLimiter();
    const a = l.reserve([{ key: "x", max: 2 }]);
    l.reserve([{ key: "x", max: 2 }]);
    expect("retryAfter" in l.reserve([{ key: "x", max: 2 }])).toBe(true);
    if ("release" in a) a.release();
    expect("release" in l.reserve([{ key: "x", max: 2 }])).toBe(true);
  });

  it("IPv6 сводится к /64, IPv4 и ::ffff: — как есть", () => {
    expect(limiterIpKey("2001:db8:85a3:1:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:85a3:1::/64");
    expect(limiterIpKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(limiterIpKey("::ffff:10.0.0.1")).toBe("10.0.0.1");
    expect(limiterIpKey("8.8.8.8")).toBe("8.8.8.8");
  });
});

describe("/api/db", () => {
  it("без сессии — 401", async () => {
    expect((await post("/db", { table: "leads", action: "select" })).status).toBe(401);
  });

  it("CRUD лида и типы как в Supabase: number, YYYY-MM-DD, ISO", async () => {
    const cookie = await signIn("sergey@example.com");
    const ins = await post(
      "/db",
      {
        table: "leads",
        action: "insert",
        columns: "*",
        values: { company: "Бастион", next_step_date: "2026-09-21", deal_amount: 120000.5, priority: 1 },
      },
      cookie,
    );
    const { data } = await json(ins);
    expect(data[0]).toMatchObject({ company: "Бастион", next_step_date: "2026-09-21", deal_amount: 120000.5, priority: 1, stage: "new" });
    expect(data[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const id = data[0].id;
    const upd = await post(
      "/db",
      { table: "leads", action: "update", columns: "*", values: { stage: "sent" }, filters: [{ column: "id", op: "eq", value: id }] },
      cookie,
    );
    expect((await json(upd)).data[0].stage).toBe("sent");

    const bad = await post(
      "/db",
      { table: "leads", action: "update", columns: "*", values: { stage: "лишний" }, filters: [{ column: "id", op: "eq", value: id }] },
      cookie,
    );
    expect(bad.status).toBe(400);
    expect((await json(bad)).error.message).toBe("Значение не проходит проверку");

    await post("/db", { table: "leads", action: "delete", filters: [{ column: "id", op: "eq", value: id }] }, cookie);
    const after = await post("/db", { table: "leads", action: "select", filters: [{ column: "id", op: "eq", value: id }] }, cookie);
    expect((await json(after)).data).toEqual([]);
  });

  it("настройки налога: upsert с дефолтами и правка ставок и вычета", async () => {
    const cookie = await signIn("sergey@example.com");
    const ins = await post(
      "/db",
      {
        table: "settings",
        action: "upsert",
        columns: "*",
        // Значения намеренно не дефолтные: иначе тест пройдёт и если их проигнорировать
        values: { tax_rate: 5, tax_reduced_rate: 2.5, tax_deduction_start: 7300, default_monthly_goal: null },
        onConflict: "user_id",
        ignoreDuplicates: true,
      },
      cookie,
    );
    expect(ins.status).toBe(200);

    const read = await post("/db", { table: "settings", action: "select", columns: "*" }, cookie);
    const row = (await json(read)).data[0];
    expect(row).toMatchObject({ tax_rate: 5, tax_reduced_rate: 2.5, tax_deduction_start: 7300 });

    const upd = await post(
      "/db",
      {
        table: "settings",
        action: "update",
        columns: "*",
        values: { tax_reduced_rate: 3, tax_deduction_start: 2500 },
        filters: [{ column: "id", op: "eq", value: row.id }],
      },
      cookie,
    );
    expect((await json(upd)).data[0]).toMatchObject({ tax_reduced_rate: 3, tax_deduction_start: 2500 });

    // Инвариант держит база, а не только форма: напрямую через API тоже нельзя
    const broken = await post(
      "/db",
      {
        table: "settings",
        action: "update",
        columns: "*",
        values: { tax_reduced_rate: 99 },
        filters: [{ column: "id", op: "eq", value: row.id }],
      },
      cookie,
    );
    expect(broken.status).toBeGreaterThanOrEqual(400);

    const negative = await post(
      "/db",
      {
        table: "settings",
        action: "update",
        columns: "*",
        values: { tax_deduction_start: -1 },
        filters: [{ column: "id", op: "eq", value: row.id }],
      },
      cookie,
    );
    expect(negative.status).toBeGreaterThanOrEqual(400);

    const still = await post("/db", { table: "settings", action: "select", columns: "*" }, cookie);
    expect((await json(still)).data[0]).toMatchObject({ tax_reduced_rate: 3, tax_deduction_start: 2500 });
  });

  it("чужие строки не видны, не меняются и не удаляются", async () => {
    const mine = await signIn("sergey@example.com");
    const other = await signIn("other@example.com");
    const ins = await post("/db", { table: "clients", action: "insert", columns: "id", values: { name: "Мой клиент" } }, mine);
    const id = (await json(ins)).data[0].id;

    const seen = await post("/db", { table: "clients", action: "select" }, other);
    expect((await json(seen)).data.map((r: { id: string }) => r.id)).not.toContain(id);

    const upd = await post(
      "/db",
      { table: "clients", action: "update", columns: "*", values: { name: "Взлом" }, filters: [{ column: "id", op: "eq", value: id }] },
      other,
    );
    expect((await json(upd)).data).toEqual([]);
    await post("/db", { table: "clients", action: "delete", filters: [{ column: "id", op: "eq", value: id }] }, other);

    const still = await post("/db", { table: "clients", action: "select", filters: [{ column: "id", op: "eq", value: id }] }, mine);
    expect((await json(still)).data[0].name).toBe("Мой клиент");
  });

  it("нельзя сослаться на чужой лид", async () => {
    const mine = await signIn("sergey@example.com");
    const other = await signIn("other@example.com");
    const lead = await post("/db", { table: "leads", action: "insert", columns: "id", values: { company: "Чужой" } }, mine);
    const leadId = (await json(lead)).data[0].id;

    const touch = await post(
      "/db",
      { table: "lead_touches", action: "insert", values: { lead_id: leadId, type: "note", date: "2026-09-14", comment: "x" } },
      other,
    );
    expect(touch.status).toBe(400);
    expect((await json(touch)).error.message).toContain("lead_id");
  });

  it("нельзя подменить user_id, читать служебные таблицы, собрать кривой запрос", async () => {
    const cookie = await signIn("sergey@example.com");
    const cases: unknown[] = [
      { table: "clients", action: "insert", values: { name: "x", user_id: "00000000-0000-4000-8000-000000000000" } },
      { table: "users", action: "select" },
      { table: "sessions", action: "select" },
      { table: "login_events", action: "select" },
      { table: "trusted_devices", action: "select" },
      { table: "leads", action: "select", columns: "company, (select password_hash from users limit 1)" },
      { table: "leads", action: "select", order: [{ column: "company; drop table leads", ascending: true, nullsFirst: false }] },
      { table: "leads", action: "delete" },
      { table: "leads", action: "update", values: { company: "x" } },
      // L1: форма запроса
      { table: ["leads"], action: "select" },
      { table: "leads", action: "select", filters: { column: "id" } },
      { table: "leads", action: "select", columns: ["*"] },
      { table: "clients", action: "insert", values: [null] },
      { table: "clients", action: "insert", values: true },
      { table: "clients", action: "insert", values: { name: { nested: [1] } } },
      { table: "leads", action: "select", filters: [{ column: "id", op: "eq" }] },
      { table: "leads", action: "select", filters: [{ column: "id", op: "eq", value: ["a"] }] },
      { table: "leads", action: "select", filters: [{ column: "id", op: "in", value: Array.from({ length: 1001 }, (_, i) => String(i)) }] },
      { table: "leads", action: "select", limit: 1_000_000 },
      { table: "leads", action: "select", order: [{ column: "company" }] },
      { table: "leads", action: "drop" },
    ];
    for (const req of cases) {
      const res = await post("/db", req, cookie);
      expect(res.status, JSON.stringify(req).slice(0, 120)).toBe(400);
    }
  });

  it("upsert категорий: ignoreDuplicates не плодит дубли; цели обновляются", async () => {
    const cookie = await signIn("sergey@example.com");
    const cats = { table: "categories", action: "upsert", onConflict: "user_id,type,name", ignoreDuplicates: true, values: [{ type: "income", name: "Боты" }, { type: "income", name: "Боты" }] };
    expect((await post("/db", cats, cookie)).status).toBe(200);
    expect((await post("/db", cats, cookie)).status).toBe(200);
    const list = await post("/db", { table: "categories", action: "select", filters: [{ column: "name", op: "eq", value: "Боты" }] }, cookie);
    expect((await json(list)).data).toHaveLength(1);

    const goal = (amount: number) => ({ table: "goals", action: "upsert", onConflict: "user_id,year,month", columns: "*", values: { year: 2026, month: 9, target_amount: amount } });
    await post("/db", goal(100), cookie);
    const res = await post("/db", goal(250000), cookie);
    expect((await json(res)).data[0].target_amount).toBe(250000);

    expect((await post("/db", { ...goal(1), onConflict: "id" }, cookie)).status).toBe(400);
  });

  it("фильтры in / gte / lt, сортировка с nulls last, limit", async () => {
    await createUser(db, "filters@example.com", PASS);
    const cookie = await signIn("filters@example.com");
    for (const [name, due, status] of [["a", "2026-09-01", "unpaid"], ["b", null, "partial"], ["c", "2026-08-01", "paid"]] as const) {
      await post("/db", { table: "incomes", action: "insert", values: { amount: 10, date: "2026-09-10", category: name, due_date: due, payment_status: status } }, cookie);
    }
    const res = await post(
      "/db",
      {
        table: "incomes",
        action: "select",
        columns: "category, due_date",
        filters: [
          { column: "payment_status", op: "in", value: ["unpaid", "partial"] },
          { column: "date", op: "gte", value: "2026-09-01" },
          { column: "date", op: "lt", value: "2026-10-01" },
        ],
        order: [{ column: "due_date", ascending: true, nullsFirst: false }],
        limit: 5,
      },
      cookie,
    );
    expect((await json(res)).data).toEqual([
      { category: "a", due_date: "2026-09-01" },
      { category: "b", due_date: null },
    ]);
  });

  it("тело /db больше 2 МБ — 413", async () => {
    const cookie = await signIn("sergey@example.com");
    const res = await post("/db", { table: "clients", action: "insert", values: { name: "x".repeat(3 * 1024 * 1024) } }, cookie);
    expect(res.status).toBe(413);
  });
});

describe("/api/order", () => {
  const ORDER = { name: "Иван", contact: "@ivan_test", task: "бот поддержки", details: "до 100 тыс." };
  type Opts = { notify?: OrderNotifier | null; save?: OrderSaver | null };
  const appWith = ({ notify = null, save }: Opts = {}) =>
    createApp({ db, secureCookies: false, clientIp: () => ip, limiter, orderNotifier: notify, ...(save !== undefined ? { orderSaver: save } : {}) });
  const send = (a: ReturnType<typeof createApp>, body: unknown, csrf = true) =>
    a.request("/api/order", {
      method: "POST",
      headers: { "content-type": "application/json", ...(csrf ? { "x-webik": "1" } : {}) },
      body: JSON.stringify(body),
    });
  const siteLeads = () =>
    db.query<Record<string, unknown>>(
      `select l.*, u.email as owner, t.type as touch_type, t.comment as touch_comment
       from leads l join users u on u.id = l.user_id left join lead_touches t on t.lead_id = l.id
       where l.source in ('Сайт', 'Бот') order by l.created_at`,
    );

  it("заявка без входа в админку попадает в CRM входящим лидом", async () => {
    const before = (await siteLeads()).length;
    const res = await send(appWith(), ORDER);
    expect(res.status).toBe(200);
    const leads = await siteLeads();
    expect(leads).toHaveLength(before + 1);
    expect(leads.at(-1)).toMatchObject({
      owner: "sergey@example.com",
      company: "Иван — заявка с сайта",
      contact_name: "Иван",
      telegram_username: "ivan_test",
      email: null,
      business: "бот поддержки",
      source: "Сайт",
      stage: "replied",
      reached_stage: "replied",
      next_step: "Ответить и квалифицировать",
      touch_type: "message",
    });
    expect(leads.at(-1)!.touch_comment).toContain("Детали: до 100 тыс.");
  });

  it("уведомление, если настроено, получает заявку и id лида", async () => {
    const sent: string[] = [];
    const leadIds: (string | null)[] = [];
    const notify: OrderNotifier = async (n) => {
      sent.push(n.text);
      leadIds.push(n.leadId);
    };
    expect((await send(appWith({ notify }), ORDER)).status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("форма на сайте");
    // Уведомление знает id лида — для ссылки на карточку в письме
    const [row] = await db.query<{ id: string }>("select id from leads order by created_at desc limit 1");
    expect(leadIds).toEqual([row.id]);
  });

  it("без заголовка X-WebIK — 403 и ничего не записано", async () => {
    const before = (await siteLeads()).length;
    expect((await send(appWith(), ORDER, false)).status).toBe(403);
    expect(await siteLeads()).toHaveLength(before);
  });

  it("поле-ловушка: ответ «ок», но ничего не записано", async () => {
    const before = (await siteLeads()).length;
    const warn = console.warn;
    console.warn = () => {};
    try {
      expect((await send(appWith(), { ...ORDER, website: "spam.example" })).status).toBe(200);
    } finally {
      console.warn = warn;
    }
    expect(await siteLeads()).toHaveLength(before);
  });

  it("CRM упала, а Telegram дошёл — заявка принята; упало всё — 502", async () => {
    const errorLog = console.error;
    console.error = () => {};
    try {
      const failSave = async () => {
        throw new Error("db down");
      };
      expect((await send(appWith({ save: failSave, notify: async () => {} }), ORDER)).status).toBe(200);
      const res = await send(
        appWith({
          save: failSave,
          notify: async () => {
            throw new Error("telegram down");
          },
        }),
        ORDER,
      );
      expect(res.status).toBe(502);
      expect(await json(res)).toMatchObject({ error: expect.stringContaining("@d0vbnyak") });
    } finally {
      console.error = errorLog;
    }
  });

  it("неполная заявка — 400; нет ни CRM, ни Telegram — 503; флуд — 429", async () => {
    expect((await send(appWith(), { task: "бот" })).status).toBe(400);
    expect((await send(appWith({ save: null }), ORDER)).status).toBe(503);

    ip = "5.5.5.5";
    const a = appWith();
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await send(a, ORDER)).status);
    expect(statuses).toEqual([200, 200, 200, 429]);
  });
});

describe("миграции", () => {
  it("R5: команды управления транзакцией находятся в любом месте", () => {
    for (const bad of ["commit work;", "select 1; commit;", "end transaction;", "begin isolation level serializable;", "rollback to savepoint x;", "-- x\nCOMMIT"]) {
      expect(hasTransactionControl(bad), bad).toBe(true);
    }
    expect(hasTransactionControl("alter table x add column committed_at timestamptz; -- commit;")).toBe(false);
  });

  it("упавшая миграция откатывается, база остаётся рабочей", async () => {
    const mem = await createPgliteDb();
    try {
      await expect(mem.execInTransaction("create table t1 (id int); select * from нет_такой;")).rejects.toThrow();
      expect(await mem.query("select to_regclass('t1') as t")).toEqual([{ t: null }]); // откатилось
      expect(await mem.query("select 1 as ok")).toEqual([{ ok: 1 }]);
    } finally {
      await mem.close();
    }
  });
});

describe("/api/ai/opener", () => {
  const draft = { first_line: "Увидел у вас бесплатный выезд" };
  const calls: unknown[] = [];
  const withOpener = (opener: Parameters<typeof createApp>[0]["opener"]) => {
    app = createApp({ db, secureCookies: false, clientIp: () => ip, limiter, opener });
  };
  const newLead = async (cookie: string, values: Record<string, unknown>) => {
    const res = await post("/db", { table: "leads", action: "insert", columns: "id", values }, cookie);
    return (await json(res)).data[0].id as string;
  };

  beforeEach(() => {
    calls.length = 0;
    withOpener(async (input) => {
      calls.push(input);
      return draft as never;
    });
  });

  it("без сессии — 401, без X-WebIK — 403", async () => {
    expect((await post("/ai/opener", { leadId: crypto.randomUUID() })).status).toBe(401);
    const cookie = await signIn("sergey@example.com");
    expect((await post("/ai/opener", { leadId: crypto.randomUUID() }, cookie, false)).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("свой лид с сайтом → черновик; в ИИ уходят только компания, город и сайт", async () => {
    const cookie = await signIn("sergey@example.com");
    const id = await newLead(cookie, {
      company: "Охрана-Сервис",
      city: "Казань",
      website: "ohrana.ru",
      email: "boss@ohrana.ru",
      contact_name: "Иван Петров",
    });
    const res = await post("/ai/opener", { leadId: id }, cookie);
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ draft });
    expect(calls).toEqual([{ company: "Охрана-Сервис", city: "Казань", website: "ohrana.ru" }]);
  });

  it("чужой лид — 404, лид без сайта — 400, мусор вместо id — 400", async () => {
    const other = await signIn("other@example.com");
    const foreign = await newLead(other, { company: "Чужая", website: "chuzhaya.ru" });
    const cookie = await signIn("sergey@example.com");
    expect((await post("/ai/opener", { leadId: foreign }, cookie)).status).toBe(404);
    const bare = await newLead(cookie, { company: "Без сайта" });
    const res = await post("/ai/opener", { leadId: bare }, cookie);
    expect(res.status).toBe(400);
    expect((await json(res)).error).toContain("не указан сайт");
    expect((await post("/ai/opener", { leadId: "1 or 1=1" }, cookie)).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("ошибка ИИ — её статус и текст; неожиданная — 502 без подробностей; без ключей — 503", async () => {
    const cookie = await signIn("sergey@example.com");
    const id = await newLead(cookie, { company: "Сбой", website: "sboi.ru" });
    withOpener(async () => {
      throw new OpenerError("Не получилось прочитать сайт: Сайт ответил ошибкой 503.", 422);
    });
    let res = await post("/ai/opener", { leadId: id }, cookie);
    expect(res.status).toBe(422);
    expect((await json(res)).error).toContain("ошибкой 503");

    withOpener(async () => {
      throw new Error("секретная внутренняя ошибка");
    });
    res = await post("/ai/opener", { leadId: id }, cookie);
    expect(res.status).toBe(502);
    expect(JSON.stringify(await json(res))).not.toContain("секретная");

    withOpener(null);
    res = await post("/ai/opener", { leadId: id }, cookie);
    expect(res.status).toBe(503);
  });
});

describe("/api/webik — плагин", () => {
  const pluginPost = (body: unknown, token?: string, csrf = true) =>
    app.request("/api/webik/projects", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(csrf ? { "x-webik": "1" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  const issue = async (cookie: string) => {
    const res = await post("/webik/token", {}, cookie);
    expect(res.status).toBe(200);
    return (await json(res)).token as string;
  };
  const project = async (cookie: string, slug: string) => {
    const res = await post("/db", { table: "projects", action: "select", columns: "*", filters: [{ column: "slug", op: "eq", value: slug }] }, cookie);
    return (await json(res)).data[0];
  };
  const events = async (cookie: string, projectId: string) => {
    const res = await post("/db", { table: "project_events", action: "select", columns: "*", filters: [{ column: "project_id", op: "eq", value: projectId }] }, cookie);
    return (await json(res)).data as { type: string; comment: string }[];
  };

  it("токен выпускается только по сессии, в базе — хеш, показывается один раз", async () => {
    expect((await post("/webik/token", {})).status).toBe(401);
    const cookie = await signIn("sergey@example.com");
    const token = await issue(cookie);
    expect(isTokenFormat(token)).toBe(true);
    const stored = await db.query<{ id: string }>("select id from api_tokens");
    expect(stored.map((r) => r.id)).not.toContain(token);
    const info = await json(await app.request("/api/webik/token", { headers: { cookie } }));
    expect(info.info.created_at).toBeTruthy();
    expect(JSON.stringify(info)).not.toContain(token);
  });

  it("без токена, с мусором, без X-WebIK — отказ; после отзыва и перевыпуска старый не работает", async () => {
    const state = { slug: "stroymir", stage: "audited" };
    expect((await pluginPost(state)).status).toBe(401);
    expect((await pluginPost(state, "x".repeat(43))).status).toBe(401);
    const cookie = await signIn("sergey@example.com");
    const first = await issue(cookie);
    expect((await pluginPost(state, first, false)).status).toBe(403);
    const second = await issue(cookie);
    expect((await pluginPost(state, first)).status).toBe(401);
    expect((await pluginPost(state, second)).status).toBeLessThan(300);
    const del = await app.request("/api/webik/token", { method: "DELETE", headers: { cookie, "x-webik": "1" } });
    expect(del.status).toBe(200);
    expect((await pluginPost(state, second)).status).toBe(401);
  });

  it("state.json создаёт проект, повтор обновляет; смена этапа — в журнал; пустые ссылки не стирают", async () => {
    const cookie = await signIn("sergey@example.com");
    const token = await issue(cookie);
    let res = await pluginPost({ slug: "zerno", stage: "audited", source_url: "https://www.zerno-cafe.ru/", updated: "2026-10-19" }, token);
    expect(res.status).toBe(201);
    let p = await project(cookie, "zerno");
    expect(p).toMatchObject({ name: "zerno-cafe.ru", stage: "audited", source_url: "https://www.zerno-cafe.ru/" });
    expect(p.synced_at).toBeTruthy();

    res = await pluginPost({ slug: "zerno", stage: "demo", demo_url: "https://zerno.demo.webik.tech", source_url: null }, token);
    expect(res.status).toBe(200);
    p = await project(cookie, "zerno");
    expect(p).toMatchObject({ stage: "demo", demo_url: "https://zerno.demo.webik.tech/", source_url: "https://www.zerno-cafe.ru/" });
    expect((await events(cookie, p.id)).map((e) => e.comment)).toEqual([
      "Плагин: проект создан на этапе «Аудит»",
      "Плагин: Аудит → Демо",
    ]);

    // Тот же этап — без новой записи в журнале
    await pluginPost({ slug: "zerno", stage: "demo" }, token);
    expect(await events(cookie, p.id)).toHaveLength(2);
  });

  it("проект на проде плагин назад не откатывает; проекты разных пользователей не пересекаются", async () => {
    const cookie = await signIn("sergey@example.com");
    const token = await issue(cookie);
    await pluginPost({ slug: "lux", stage: "demo" }, token);
    const p = await project(cookie, "lux");
    await post("/db", { table: "projects", action: "update", values: { stage: "prod" }, filters: [{ column: "id", op: "eq", value: p.id }] }, cookie);
    await pluginPost({ slug: "lux", stage: "built" }, token);
    expect((await project(cookie, "lux")).stage).toBe("prod");

    const other = await signIn("other@example.com");
    const otherToken = await issue(other);
    expect((await pluginPost({ slug: "lux", stage: "audited" }, otherToken)).status).toBe(201);
    expect((await project(cookie, "lux")).stage).toBe("prod");
    expect((await project(other, "lux")).stage).toBe("audited");
  });

  it("плохой slug, этап «прод» или чужая схема ссылки — 400", async () => {
    const cookie = await signIn("sergey@example.com");
    const token = await issue(cookie);
    for (const body of [
      { slug: "../etc", stage: "audited" },
      { slug: "ok", stage: "prod" },
      { slug: "ok", stage: "demo", demo_url: "javascript:alert(1)" },
      [1, 2],
    ]) {
      expect((await pluginPost(body, token)).status).toBe(400);
    }
  });
});

describe("buildQuery / validateRequest", () => {
  it("значения только параметрами, user_id — первым условием", () => {
    const q = buildQuery(validateRequest({ table: "leads", action: "select", columns: "id, company", filters: [{ column: "company", op: "eq", value: "'; drop" }] }), "u1");
    expect(q.sql).toBe('select "id", "company" from "leads" where "user_id" = $1 and "company" = $2');
    expect(q.params).toEqual(["u1", "'; drop"]);
  });
  it("eq null → is null, пустой in → false", () => {
    const q = buildQuery({ table: "leads", action: "select", filters: [{ column: "client_id", op: "eq", value: null }, { column: "stage", op: "in", value: [] }] }, "u1");
    expect(q.sql).toContain('"client_id" is null and false');
  });
  it("id при вставке — только UUID; __proto__ как таблица — нет", () => {
    expect(() => buildQuery({ table: "leads", action: "insert", values: { id: "1 or 1=1", company: "x" } }, "u1")).toThrow(QueryError);
    expect(() => validateRequest(JSON.parse('{"__proto__": {"table": "leads"}, "action": "select"}'))).toThrow(QueryError);
  });
});

it("parseTimestamp", () => {
  expect(parseTimestamp("2026-09-14 09:00:00.123+03")).toBe("2026-09-14T06:00:00.123Z");
  expect(parseTimestamp("2026-09-14T06:00:00Z")).toBe("2026-09-14T06:00:00.000Z");
});
