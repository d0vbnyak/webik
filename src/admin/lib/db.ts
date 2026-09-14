// Клиент базы админки. Повторяет ту часть конструктора supabase-js, которой
// пользуются хуки (`db.from("leads").select("*").eq("id", x)`), но ходит в свой
// API на /api/db (server/api). Переезд с Supabase не потребовал переписывать хуки.
//
// Запрос выполняется, когда его ждут через await, — как в supabase-js.

type Filter = { column: string; op: "eq" | "in" | "gte" | "lt"; value: unknown };

export type DbError = { message: string; code?: string };
export type DbResult<T = unknown> = { data: T; error: DbError | null };

type Action = "select" | "insert" | "update" | "delete" | "upsert";

export type DbRequest = {
  table: string;
  action: Action;
  columns?: string;
  filters: Filter[];
  order: { column: string; ascending: boolean; nullsFirst: boolean }[];
  limit?: number;
  values?: unknown;
  onConflict?: string;
  ignoreDuplicates?: boolean;
};

/** Общие заголовки для POST: X-WebIK — защита от CSRF (см. server/api/app.ts). */
export const API_HEADERS = { "content-type": "application/json", "x-webik": "1" };

/** Сессия истекла — AuthContext подписывается и отправляет на страницу входа. */
export const sessionExpired = new EventTarget();

export class QueryBuilder<T = any> implements PromiseLike<DbResult<T>> {
  private req: DbRequest;
  private mode: "many" | "single" | "maybe" = "many";

  constructor(
    table: string,
    private send: (req: DbRequest) => Promise<DbResult<unknown[] | null>>,
  ) {
    this.req = { table, action: "select", filters: [], order: [] };
  }

  /** Для select — какие колонки читать; после insert/update/upsert/delete — вернуть строки. */
  select(columns = "*"): QueryBuilder<T> {
    this.req.columns = columns;
    return this;
  }
  insert(values: object | object[]): QueryBuilder<T> {
    return this.write("insert", values);
  }
  upsert(values: object | object[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}): QueryBuilder<T> {
    this.write("upsert", values);
    this.req.onConflict = opts.onConflict;
    this.req.ignoreDuplicates = opts.ignoreDuplicates;
    return this;
  }
  update(values: object): QueryBuilder<T> {
    return this.write("update", values);
  }
  delete(): QueryBuilder<T> {
    this.req.action = "delete";
    return this;
  }
  eq(column: string, value: unknown): QueryBuilder<T> {
    return this.filter(column, "eq", value);
  }
  in(column: string, value: unknown[]): QueryBuilder<T> {
    return this.filter(column, "in", value);
  }
  gte(column: string, value: unknown): QueryBuilder<T> {
    return this.filter(column, "gte", value);
  }
  lt(column: string, value: unknown): QueryBuilder<T> {
    return this.filter(column, "lt", value);
  }
  order(column: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}): QueryBuilder<T> {
    const ascending = opts.ascending ?? true;
    // Как в Postgres и PostgREST: nulls last при asc, nulls first при desc
    this.req.order.push({ column, ascending, nullsFirst: opts.nullsFirst ?? !ascending });
    return this;
  }
  limit(n: number): QueryBuilder<T> {
    this.req.limit = n;
    return this;
  }
  single(): QueryBuilder<T> {
    this.mode = "single";
    return this;
  }
  maybeSingle(): QueryBuilder<T> {
    this.mode = "maybe";
    return this;
  }

  /** Описание запроса — для тестов. */
  toRequest(): DbRequest {
    return structuredClone(this.req);
  }

  private write(action: Action, values: unknown): QueryBuilder<T> {
    this.req.action = action;
    this.req.values = values;
    return this;
  }
  private filter(column: string, op: Filter["op"], value: unknown): QueryBuilder<T> {
    this.req.filters.push({ column, op, value });
    return this;
  }

  private async run(): Promise<DbResult<T>> {
    const res = await this.send(this.req);
    if (res.error) return { data: null as T, error: res.error };
    if (this.mode === "many") return { data: res.data as T, error: null };
    const rows = res.data ?? [];
    if (rows.length > 1) return { data: null as T, error: { message: "Ожидалась одна строка, пришло несколько" } };
    if (rows.length === 0) {
      return this.mode === "maybe"
        ? { data: null as T, error: null }
        : { data: null as T, error: { message: "Запись не найдена" } };
    }
    return { data: rows[0] as T, error: null };
  }

  then<A = DbResult<T>, B = never>(
    onfulfilled?: ((value: DbResult<T>) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.run().then(onfulfilled, onrejected);
  }
}

async function sendToApi(req: DbRequest): Promise<DbResult<unknown[] | null>> {
  try {
    const res = await fetch("/api/db", {
      method: "POST",
      credentials: "same-origin",
      headers: API_HEADERS,
      body: JSON.stringify(req),
    });
    if (res.status === 401) sessionExpired.dispatchEvent(new Event("expired"));
    const body = (await res.json().catch(() => null)) as DbResult<unknown[] | null> | null;
    if (!body) return { data: null, error: { message: `Сервер ответил ${res.status}` } };
    return body;
  } catch {
    return { data: null, error: { message: "Нет связи с сервером" } };
  }
}

export const db = {
  from: <T = any>(table: string) => new QueryBuilder<T>(table, sendToApi),
};
