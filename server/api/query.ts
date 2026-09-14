/**
 * Запрос админки → параметризованный SQL.
 *
 * Фронтенд пользуется тем же конструктором, что был у Supabase
 * (`db.from("leads").select("*").eq("id", x)`), и шлёт его описание на /api/db.
 * Здесь это описание проверяется и превращается в SQL. Правила:
 * - таблица и все колонки — только из белого списка tables.ts;
 * - значения — только параметрами ($1, $2…), в текст SQL не попадают;
 * - к каждому запросу добавляется `user_id = <из сессии>`, при вставке user_id
 *   ставится сервером — чужие строки не видны и не меняются;
 * - update и delete без фильтра запрещены: случайно стереть всё нельзя.
 */
import { REFERENCES, TABLES, type TableSpec } from "./tables";

export type Filter = { column: string; op: "eq" | "in" | "gte" | "lt"; value: unknown };

export type DbRequest = {
  table: string;
  action: "select" | "insert" | "update" | "delete" | "upsert";
  /** Колонки ответа: "*" или "a, b". Пусто — ответ без строк (как без .select() в Supabase). */
  columns?: string;
  filters?: Filter[];
  order?: { column: string; ascending: boolean; nullsFirst: boolean }[];
  limit?: number;
  values?: Record<string, unknown> | Record<string, unknown>[];
  onConflict?: string;
  ignoreDuplicates?: boolean;
};

export class QueryError extends Error {}

export type BuiltQuery = { sql: string; params: unknown[] };

function spec(table: string): TableSpec {
  if (!Object.hasOwn(TABLES, table)) throw new QueryError(`Таблица «${table}» недоступна`);
  return TABLES[table];
}

function checkColumn(s: TableSpec, table: string, column: string, list: readonly string[] = s.columns): string {
  if (!list.includes(column)) throw new QueryError(`Колонка «${column}» недоступна в «${table}»`);
  return `"${column}"`;
}

function returning(s: TableSpec, table: string, columns: string | undefined): string {
  if (!columns) return "";
  const trimmed = columns.trim();
  if (trimmed === "*") return ` returning ${s.columns.map((c) => `"${c}"`).join(", ")}`;
  const cols = trimmed.split(",").map((c) => checkColumn(s, table, c.trim()));
  return ` returning ${cols.join(", ")}`;
}

/**
 * Проверки ссылок перед записью: каждый client_id / lead_id / recurring_id из
 * значений должен принадлежать тому же пользователю. Возвращает запросы, каждый
 * из которых обязан вернуть ровно `expected` строк.
 */
export function referenceChecks(req: DbRequest, userId: string): (BuiltQuery & { expected: number; column: string })[] {
  if (req.action === "select" || req.action === "delete" || !req.values) return [];
  const refs = REFERENCES[req.table] ?? {};
  const rows = Array.isArray(req.values) ? req.values : [req.values];
  const checks: (BuiltQuery & { expected: number; column: string })[] = [];
  for (const [column, refTable] of Object.entries(refs)) {
    const ids = [...new Set(rows.map((r) => r[column]).filter((v) => v !== null && v !== undefined))];
    if (ids.length === 0) continue;
    if (!ids.every((v) => typeof v === "string" && UUID.test(v))) throw new QueryError(`${column} должен быть UUID`);
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
    checks.push({
      sql: `select "id" from "${refTable}" where "user_id" = $1 and "id" in (${placeholders})`,
      params: [userId, ...ids],
      expected: ids.length,
      column,
    });
  }
  return checks;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildQuery(req: DbRequest, userId: string): BuiltQuery {
  const s = spec(req.table);
  const t = `"${req.table}"`;
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  const where = (): string => {
    const parts = [`"user_id" = ${p(userId)}`];
    for (const f of req.filters ?? []) {
      const col = checkColumn(s, req.table, f.column);
      switch (f.op) {
        case "eq":
          parts.push(f.value === null ? `${col} is null` : `${col} = ${p(f.value)}`);
          break;
        case "gte":
          parts.push(`${col} >= ${p(f.value)}`);
          break;
        case "lt":
          parts.push(`${col} < ${p(f.value)}`);
          break;
        case "in": {
          if (!Array.isArray(f.value)) throw new QueryError("Фильтр in ждёт массив");
          if (f.value.length === 0) parts.push("false");
          else parts.push(`${col} in (${f.value.map(p).join(", ")})`);
          break;
        }
        default:
          throw new QueryError("Неизвестный фильтр");
      }
    }
    return ` where ${parts.join(" and ")}`;
  };

  const rowsOf = (): Record<string, unknown>[] => {
    const rows = Array.isArray(req.values) ? req.values : req.values ? [req.values] : [];
    if (rows.length === 0) throw new QueryError("Нет данных для записи");
    if (rows.length > 1000) throw new QueryError("Слишком много строк за раз");
    return rows;
  };

  const checkId = (row: Record<string, unknown>) => {
    if ("id" in row && (typeof row.id !== "string" || !UUID.test(row.id))) {
      throw new QueryError("id должен быть UUID");
    }
  };

  switch (req.action) {
    case "select": {
      const cols = returning(s, req.table, req.columns || "*").replace(" returning ", "");
      let sql = `select ${cols} from ${t}${where()}`;
      if (req.order?.length) {
        const parts = req.order.map(
          (o) =>
            `${checkColumn(s, req.table, o.column)} ${o.ascending ? "asc" : "desc"} nulls ${o.nullsFirst ? "first" : "last"}`,
        );
        sql += ` order by ${parts.join(", ")}`;
      }
      if (req.limit !== undefined) {
        if (!Number.isInteger(req.limit) || req.limit < 0) throw new QueryError("Некорректный limit");
        sql += ` limit ${p(req.limit)}`;
      }
      return { sql, params };
    }

    case "insert":
    case "upsert": {
      const rows = rowsOf();
      // Колонки — объединение ключей всех строк; отсутствующие у строки → default
      const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      keys.forEach((k) => checkColumn(s, req.table, k, s.writable));
      rows.forEach(checkId);
      const colList = [`"user_id"`, ...keys.map((k) => `"${k}"`)].join(", ");
      const values = rows
        .map((r) => `(${[p(userId), ...keys.map((k) => (k in r ? p(r[k]) : "default"))].join(", ")})`)
        .join(", ");
      let sql = `insert into ${t} (${colList}) values ${values}`;
      if (req.action === "upsert") {
        const target = (req.onConflict ?? "").split(",").map((c) => c.trim());
        const allowed = s.conflictTargets?.some((ct) => ct.length === target.length && ct.every((c, i) => c === target[i]));
        if (!allowed) throw new QueryError(`Upsert по «${req.onConflict}» недоступен в «${req.table}»`);
        const conflict = target.map((c) => `"${c}"`).join(", ");
        const updatable = keys.filter((k) => !target.includes(k) && k !== "id");
        sql +=
          req.ignoreDuplicates || updatable.length === 0
            ? ` on conflict (${conflict}) do nothing`
            : ` on conflict (${conflict}) do update set ${updatable.map((k) => `"${k}" = excluded."${k}"`).join(", ")}`;
      }
      return { sql: sql + returning(s, req.table, req.columns), params };
    }

    case "update": {
      const [row] = rowsOf();
      if (Array.isArray(req.values)) throw new QueryError("update принимает одну строку значений");
      if (!req.filters?.length) throw new QueryError("update без фильтра запрещён");
      const keys = Object.keys(row).filter((k) => k !== "id");
      if (keys.length === 0) throw new QueryError("Нечего обновлять");
      const set = keys.map((k) => `${checkColumn(s, req.table, k, s.writable)} = ${p(row[k])}`).join(", ");
      return { sql: `update ${t} set ${set}${where()}${returning(s, req.table, req.columns)}`, params };
    }

    case "delete": {
      if (!req.filters?.length) throw new QueryError("delete без фильтра запрещён");
      return { sql: `delete from ${t}${where()}${returning(s, req.table, req.columns)}`, params };
    }

    default:
      throw new QueryError("Неизвестное действие");
  }
}
