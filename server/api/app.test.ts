// Интеграционные тесты API на настоящем Postgres (PGlite в памяти).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, migrate, parseTimestamp, type Db } from "../db/db";
import { createApp } from "./app";
import { LoginLimiter, createUser, hashPassword, verifyPassword } from "./auth";
import { buildQuery, QueryError } from "./query";

let db: Db;
let app: ReturnType<typeof createApp>;
let limiter: LoginLimiter;

const PASS = "correct horse battery";

const json = (r: Response): Promise<any> => r.json();

beforeAll(async () => {
  db = await createPgliteDb();
  expect(await migrate(db)).toEqual(["001_init.sql"]);
  expect(await migrate(db)).toEqual([]); // повторный прогон ничего не делает
  await createUser(db, "Sergey@Example.com", PASS);
  await createUser(db, "other@example.com", PASS);
}, 60_000);

afterAll(async () => {
  await db.close();
});

beforeEach(() => {
  limiter = new LoginLimiter();
  app = createApp({ db, secureCookies: false, clientIp: () => "1.2.3.4", limiter });
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

async function signIn(email: string): Promise<string> {
  const res = await post("/auth/login", { email, password: PASS });
  expect(res.status).toBe(200);
  const setCookie = res.headers.get("set-cookie") ?? "";
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("SameSite=Strict");
  return setCookie.split(";")[0];
}

describe("вход", () => {
  it("правильный пароль → cookie; email без учёта регистра; сессия видна", async () => {
    const cookie = await signIn("sergey@example.com");
    const res = await app.request("/api/auth/session", { headers: { cookie } });
    expect(await json(res)).toMatchObject({ user: { email: "sergey@example.com" } });
  });

  it("неверный пароль и неизвестный email — одинаковый ответ 401", async () => {
    const a = await post("/auth/login", { email: "sergey@example.com", password: "wrong password!" });
    const b = await post("/auth/login", { email: "nobody@example.com", password: "wrong password!" });
    expect(a.status).toBe(401);
    expect(await json(a)).toEqual(await json(b));
  });

  it("после 5 неудач — 429 даже с верным паролем", async () => {
    for (let i = 0; i < 5; i++) await post("/auth/login", { email: "sergey@example.com", password: "nope nope nope" });
    const res = await post("/auth/login", { email: "sergey@example.com", password: PASS });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  it("выход удаляет сессию", async () => {
    const cookie = await signIn("sergey@example.com");
    await post("/auth/logout", {}, cookie);
    const res = await post("/db", { table: "leads", action: "select" }, cookie);
    expect(res.status).toBe(401);
  });

  it("POST без заголовка X-WebIK отклоняется (CSRF)", async () => {
    const res = await post("/auth/login", { email: "sergey@example.com", password: PASS }, undefined, false);
    expect(res.status).toBe(403);
  });

  it("смена пароля выкидывает старые сессии", async () => {
    const cookie = await signIn("other@example.com");
    await createUser(db, "other@example.com", PASS);
    expect((await post("/db", { table: "leads", action: "select" }, cookie)).status).toBe(401);
  });

  it("scrypt: хеш проверяется, чужой пароль — нет, соль разная", async () => {
    const h1 = await hashPassword("secret password");
    const h2 = await hashPassword("secret password");
    expect(h1).not.toBe(h2);
    expect(await verifyPassword("secret password", h1)).toBe(true);
    expect(await verifyPassword("Secret password", h1)).toBe(false);
    expect(await verifyPassword("x", "мусор")).toBe(false);
  });

  it("короткий пароль не создаётся", async () => {
    await expect(createUser(db, "short@example.com", "123")).rejects.toThrow("короче");
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
    expect(data[0].user_id).toBeTruthy();

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

  it("нельзя сослаться на чужой лид или клиента", async () => {
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

  it("нельзя подменить user_id и писать в служебные колонки/таблицы", async () => {
    const cookie = await signIn("sergey@example.com");
    const cases = [
      { table: "clients", action: "insert", values: { name: "x", user_id: "00000000-0000-4000-8000-000000000000" } },
      { table: "users", action: "select" },
      { table: "sessions", action: "select" },
      { table: "leads", action: "select", columns: "company, (select password_hash from users limit 1)" },
      { table: "leads", action: "select", order: [{ column: "company; drop table leads", ascending: true, nullsFirst: false }] },
      { table: "leads", action: "delete" },
      { table: "leads", action: "update", values: { company: "x" } },
    ];
    for (const req of cases) {
      const res = await post("/db", req, cookie);
      expect(res.status, JSON.stringify(req)).toBe(400);
    }
  });

  it("upsert категорий: ignoreDuplicates не плодит дубли; цели обновляются", async () => {
    const cookie = await signIn("sergey@example.com");
    const cats = { table: "categories", action: "upsert", onConflict: "user_id,type,name", ignoreDuplicates: true, values: [{ type: "income", name: "Боты" }, { type: "income", name: "Боты" }] };
    // одинаковые строки в одном insert … on conflict do nothing — допустимо
    expect((await post("/db", cats, cookie)).status).toBe(200);
    expect((await post("/db", cats, cookie)).status).toBe(200);
    const list = await post("/db", { table: "categories", action: "select", filters: [{ column: "name", op: "eq", value: "Боты" }] }, cookie);
    expect((await json(list)).data).toHaveLength(1);

    const goal = (amount: number) => ({ table: "goals", action: "upsert", onConflict: "user_id,year,month", columns: "*", values: { year: 2026, month: 9, target_amount: amount } });
    await post("/db", goal(100), cookie);
    const res = await post("/db", goal(250000), cookie);
    expect((await json(res)).data[0].target_amount).toBe(250000);

    const bad = await post("/db", { ...goal(1), onConflict: "id" }, cookie);
    expect(bad.status).toBe(400);
  });

  it("фильтры in / gte / lt, сортировка с nulls last, limit", async () => {
    const cookie = await signIn("other@example.com");
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
});

describe("buildQuery", () => {
  it("значения только параметрами, user_id — первым условием", () => {
    const q = buildQuery({ table: "leads", action: "select", columns: "id, company", filters: [{ column: "company", op: "eq", value: "'; drop" }] }, "u1");
    expect(q.sql).toBe('select "id", "company" from "leads" where "user_id" = $1 and "company" = $2');
    expect(q.params).toEqual(["u1", "'; drop"]);
  });
  it("eq null → is null, пустой in → false", () => {
    const q = buildQuery({ table: "leads", action: "select", filters: [{ column: "client_id", op: "eq", value: null }, { column: "stage", op: "in", value: [] }] }, "u1");
    expect(q.sql).toContain('"client_id" is null and false');
  });
  it("id при вставке — только UUID", () => {
    expect(() => buildQuery({ table: "leads", action: "insert", values: { id: "1 or 1=1", company: "x" } }, "u1")).toThrow(QueryError);
  });
});

it("parseTimestamp", () => {
  expect(parseTimestamp("2026-09-14 09:00:00.123+03")).toBe("2026-09-14T06:00:00.123Z");
  expect(parseTimestamp("2026-09-14T06:00:00Z")).toBe("2026-09-14T06:00:00.000Z");
});
