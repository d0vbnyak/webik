/**
 * Доступ к базе. Один интерфейс на два драйвера:
 * - продакшен — обычный Postgres через `postgres` (postgres.js);
 * - разработка и тесты — PGlite, настоящий Postgres в WebAssembly, без установки.
 *
 * Типы приводятся к тому, что раньше отдавал Supabase (PostgREST), чтобы
 * фронтенд не заметил переезда: numeric → number, date → "YYYY-MM-DD",
 * timestamptz → ISO-строка.
 */
import { mkdir, readdir, readFile } from "node:fs/promises";

export type Row = Record<string, unknown>;

export interface Db {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Несколько команд за раз, без параметров. */
  exec(sql: string): Promise<void>;
  /** Команды одной транзакцией на выделенном соединении: ошибка — откат целиком. */
  execInTransaction(sql: string): Promise<void>;
  close(): Promise<void>;
}

const OID = { int8: 20, date: 1082, timestamp: 1114, timestamptz: 1184, numeric: 1700 } as const;

/** "2026-09-14 09:00:00.123+03" → "2026-09-14T06:00:00.123Z". */
export function parseTimestamp(raw: string): string {
  const s = raw.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? raw : d.toISOString();
}

const identity = (x: string) => x;

export async function createPgDb(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    // Небольшой пул: флуд попыток входа не должен ставить в очередь работу админа
    max: 4,
    onnotice: () => {},
    types: {
      numeric: { to: OID.numeric, from: [OID.numeric], serialize: String, parse: Number },
      int8: { to: OID.int8, from: [OID.int8], serialize: String, parse: Number },
      date: { to: OID.date, from: [OID.date], serialize: identity, parse: identity },
      timestamptz: {
        to: OID.timestamptz,
        from: [OID.timestamptz, OID.timestamp],
        serialize: (x: unknown) => (x instanceof Date ? x.toISOString() : String(x)),
        parse: parseTimestamp,
      },
    },
  });
  return {
    query: async <T extends Row>(text: string, params: unknown[] = []) =>
      (await sql.unsafe(text, params as never[])) as unknown as T[],
    exec: async (text) => {
      await sql.unsafe(text);
    },
    execInTransaction: async (text) => {
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
      });
    },
    close: () => sql.end({ timeout: 5 }),
  };
}

/** dataDir — папка на диске; без неё база живёт в памяти (для тестов). */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  // PGlite создаёт только последнюю папку пути — родительские делаем сами
  if (dataDir) await mkdir(dataDir, { recursive: true });
  const pg = await PGlite.create(dataDir, {
    parsers: {
      [OID.numeric]: Number,
      [OID.int8]: Number,
      [OID.date]: identity,
      [OID.timestamptz]: parseTimestamp,
      [OID.timestamp]: parseTimestamp,
    },
  });
  return {
    query: async <T extends Row>(text: string, params: unknown[] = []) =>
      (await pg.query<T>(text, params)).rows,
    exec: async (text) => {
      await pg.exec(text);
    },
    execInTransaction: async (text) => {
      await pg.transaction(async (tx) => {
        await tx.exec(text);
      });
    },
    close: () => pg.close(),
  };
}

/** Файлы миграций, которых ещё нет в schema_migrations. */
export async function pendingMigrations(db: Db): Promise<string[]> {
  await db.exec(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set((await db.query<{ name: string }>("select name from schema_migrations")).map((r) => r.name));
  return files.filter((f) => !done.has(f));
}

const MIGRATIONS_DIR = new URL("./migrations/", import.meta.url);

// Управление транзакцией внутри файла сломало бы откат: миграция и отметка о ней
// должны быть одной транзакцией. Проверяется каждый оператор (без комментариев).
// Ограничение: тела функций на plpgsql ($$ … $$) дадут ложное срабатывание —
// такие миграции придётся проверять вручную.
const TX_KEYWORDS = /^(begin|commit|rollback|end|abort|start\s+transaction|savepoint|release)\b/i;

export function hasTransactionControl(sql: string): boolean {
  const withoutComments = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutComments.split(";").some((stmt) => TX_KEYWORDS.test(stmt.trim()));
}

/** Применяет ещё не применённые файлы из server/db/migrations по порядку имён. */
export async function migrate(db: Db): Promise<string[]> {
  const applied: string[] = [];
  for (const file of await pendingMigrations(db)) {
    if (!/^[\w.-]+\.sql$/.test(file)) throw new Error(`Недопустимое имя миграции: ${file}`);
    const text = await readFile(new URL(file, MIGRATIONS_DIR), "utf8");
    if (hasTransactionControl(text)) throw new Error(`В миграции ${file} не должно быть команд управления транзакцией`);
    try {
      await db.execInTransaction(`${text}\ninsert into schema_migrations (name) values ('${file}');`);
    } catch (e) {
      throw new Error(`Миграция ${file} не применилась: ${(e as Error).message}`);
    }
    applied.push(file);
  }
  return applied;
}
