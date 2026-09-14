import { describe, expect, it } from "vitest";
import { QueryBuilder, type DbRequest } from "./db";

const build = (rows: unknown[] | null = [], error: { message: string } | null = null) => {
  const sent: DbRequest[] = [];
  const from = (table: string) =>
    new QueryBuilder(table, async (req) => {
      sent.push(structuredClone(req));
      return { data: rows, error };
    });
  return { from, sent };
};

describe("QueryBuilder", () => {
  it("цепочка supabase-js → описание запроса", () => {
    const { from } = build();
    const req = from("leads")
      .select("*")
      .eq("stage", "sent")
      .in("priority", [1, 2])
      .order("next_step_date", { ascending: true, nullsFirst: false })
      .order("company")
      .limit(10)
      .toRequest();
    expect(req).toEqual({
      table: "leads",
      action: "select",
      columns: "*",
      filters: [
        { column: "stage", op: "eq", value: "sent" },
        { column: "priority", op: "in", value: [1, 2] },
      ],
      order: [
        { column: "next_step_date", ascending: true, nullsFirst: false },
        { column: "company", ascending: true, nullsFirst: false },
      ],
      limit: 10,
    });
  });

  it("desc по умолчанию — nulls first, как в Postgres", () => {
    const { from } = build();
    expect(from("expenses").select().order("date", { ascending: false }).toRequest().order[0].nullsFirst).toBe(true);
  });

  it("insert без .select() — без колонок ответа; upsert несёт onConflict", () => {
    const { from } = build();
    const ins = from("leads").insert({ company: "x" }).toRequest();
    expect(ins).toMatchObject({ action: "insert", values: { company: "x" } });
    expect(ins.columns).toBeUndefined();
    expect(from("categories").upsert([{ name: "a" }], { onConflict: "user_id,type,name", ignoreDuplicates: true }).toRequest()).toMatchObject({
      action: "upsert",
      onConflict: "user_id,type,name",
      ignoreDuplicates: true,
    });
  });

  it("await выполняет запрос; single/maybeSingle как в supabase-js", async () => {
    const one = build([{ id: 1 }]);
    expect(await one.from("leads").select().eq("id", 1).single()).toEqual({ data: { id: 1 }, error: null });
    expect(one.sent).toHaveLength(1);

    const none = build([]);
    expect(await none.from("leads").select().maybeSingle()).toEqual({ data: null, error: null });
    expect((await none.from("leads").select().single()).error?.message).toBe("Запись не найдена");

    const many = build([{ id: 1 }, { id: 2 }]);
    expect((await many.from("leads").select().single()).error).not.toBeNull();
    expect((await many.from("leads").select()).data).toHaveLength(2);
  });

  it("ошибка сервера доходит как { data: null, error }", async () => {
    const failed = build(null, { message: "Такая запись уже есть" });
    expect(await failed.from("clients").insert({ name: "x" }).select().single()).toEqual({
      data: null,
      error: { message: "Такая запись уже есть" },
    });
  });
});
