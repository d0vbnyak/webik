// Интеграционные тесты API на настоящем Postgres (PGlite в памяти).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, migrate, parseTimestamp, type Db } from "../db/db";
import { createApp } from "./app";
import { LoginLimiter, Semaphore, createUser, hashPassword, limiterIpKey, verifyPassword } from "./auth";
import { buildQuery, QueryError, validateRequest } from "./query";
import { base32Decode, base32Encode, generateTotpSecret, totpCode, verifyTotp } from "./totp";

let db: Db;
let app: ReturnType<typeof createApp>;
let limiter: LoginLimiter;
let ip = "1.2.3.4";

const PASS = "correct horse battery";
const json = (r: Response): Promise<any> => r.json(); // eslint-disable-line @typescript-eslint/no-explicit-any

beforeAll(async () => {
  db = await createPgliteDb();
  expect(await migrate(db)).toEqual(["001_init.sql", "002_auth_hardening.sql"]);
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
    expect(await json(a)).toEqual(await json(b));
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

  it("M4: занятый семафор проверок пароля — 429 без проверки и без штрафа", async () => {
    const busy = new Semaphore(0);
    const busyApp = createApp({ db, secureCookies: false, clientIp: () => ip, limiter, passwordChecks: busy });
    const res = await busyApp.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-webik": "1" },
      body: JSON.stringify({ email: "sergey@example.com", password: PASS }),
    });
    expect(res.status).toBe(429);
    expect((await json(res)).error).toContain("занят");
    expect((await post("/auth/login", { email: "sergey@example.com", password: PASS })).status).toBe(200);
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

  it("вход требует код; неверный — 401; верный — вход; повтор того же кода — нет", async () => {
    const secret = generateTotpSecret();
    await createUser(db, "totp@example.com", PASS, { totpSecret: secret });

    const noCode = await post("/auth/login", { email: "totp@example.com", password: PASS });
    expect(noCode.status).toBe(401);
    expect(await json(noCode)).toMatchObject({ needTotp: true });

    expect((await post("/auth/login", { email: "totp@example.com", password: PASS, totp: "000000" })).status).toBe(401);

    const step = Math.floor(Date.now() / 30_000);
    const code = totpCode(secret, step);
    expect((await post("/auth/login", { email: "totp@example.com", password: PASS, totp: code })).status).toBe(200);
    expect((await post("/auth/login", { email: "totp@example.com", password: PASS, totp: code })).status).toBe(401);
  });

  it("код с неверным паролем не принимается и не сжигается", async () => {
    const secret = generateTotpSecret();
    await createUser(db, "totp2@example.com", PASS, { totpSecret: secret });
    const code = totpCode(secret, Math.floor(Date.now() / 30_000));
    expect((await post("/auth/login", { email: "totp2@example.com", password: "wrong wrong wrong", totp: code })).status).toBe(401);
    expect((await post("/auth/login", { email: "totp2@example.com", password: PASS, totp: code })).status).toBe(200);
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
  it("M2: старые ключи вычищаются при превышении потолка", () => {
    let now = 0;
    const l = new LoginLimiter(1000, 100, () => now);
    for (let i = 0; i < 150; i++) l.reserve([{ key: `k${i}`, max: 5 }]);
    expect(l.size).toBeLessThanOrEqual(100);
    now = 5000;
    l.reserve([{ key: "fresh", max: 5 }]);
    for (let i = 0; i < 200; i++) l.reserve([{ key: `n${i}`, max: 5 }]);
    expect(l.size).toBeLessThanOrEqual(100);
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

describe("миграции", () => {
  it("упавшая миграция откатывается, база остаётся рабочей", async () => {
    const mem = await createPgliteDb();
    try {
      await mem.exec("create table schema_migrations (name text primary key, applied_at timestamptz not null default now())");
      await expect(mem.exec("begin; create table t1 (id int); select * from нет_такой; commit;")).rejects.toThrow();
      await mem.exec("rollback");
      expect(await mem.query("select 1 as ok")).toEqual([{ ok: 1 }]);
    } finally {
      await mem.close();
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
