/**
 * Белый список: какие таблицы и колонки админка может читать и писать через
 * /api/db. Всё, чего здесь нет, сервер отклоняет — имя таблицы или колонки
 * из запроса никогда не попадает в SQL без проверки по этому списку.
 *
 * users, sessions и schema_migrations сюда не входят и через API недоступны.
 * user_id — не колонка для записи: сервер ставит его сам из сессии.
 */

export type TableSpec = {
  /** Все колонки, которые можно читать и по которым можно фильтровать. */
  columns: readonly string[];
  /** Колонки, которые клиент может задать при insert/update. */
  writable: readonly string[];
  /** Допустимые цели on conflict для upsert (как в уникальных ограничениях схемы). */
  conflictTargets?: readonly (readonly string[])[];
};

const base = ["id", "user_id"] as const;

export const TABLES: Record<string, TableSpec> = {
  clients: {
    columns: [...base, "name", "phone", "telegram_username", "max_link", "created_at"],
    writable: ["name", "phone", "telegram_username", "max_link"],
  },
  recurring_expenses: {
    columns: [...base, "name", "amount", "category", "next_charge_date", "reminder_days_before", "active", "created_at"],
    writable: ["name", "amount", "category", "next_charge_date", "reminder_days_before", "active"],
  },
  expenses: {
    columns: [...base, "amount", "date", "category", "comment", "recurring_id", "created_at"],
    writable: ["amount", "date", "category", "comment", "recurring_id"],
  },
  incomes: {
    columns: [...base, "amount", "date", "category", "client_id", "payment_status", "paid_amount", "due_date", "comment", "created_at"],
    writable: ["amount", "date", "category", "client_id", "payment_status", "paid_amount", "due_date", "comment"],
  },
  categories: {
    columns: [...base, "type", "name"],
    writable: ["type", "name"],
    conflictTargets: [["user_id", "type", "name"]],
  },
  goals: {
    columns: [...base, "year", "month", "target_amount"],
    writable: ["year", "month", "target_amount"],
    conflictTargets: [["user_id", "year", "month"]],
  },
  settings: {
    columns: [...base, "tax_rate", "tax_reduced_rate", "tax_deduction_start", "default_monthly_goal"],
    writable: ["tax_rate", "tax_reduced_rate", "tax_deduction_start", "default_monthly_goal"],
    conflictTargets: [["user_id"]],
  },
  leads: {
    columns: [
      ...base, "company", "inn", "city", "website", "email", "phone", "contact_name", "telegram_username",
      "other_channels", "business", "hook", "variant", "first_line", "priority", "source", "stage",
      "reached_stage", "lost_reason", "next_step", "next_step_date", "deal_amount", "client_id",
      "stage_changed_at", "created_at",
    ],
    // id можно задать при вставке: импорт сам генерирует id, чтобы привязать касания
    writable: [
      "id", "company", "inn", "city", "website", "email", "phone", "contact_name", "telegram_username",
      "other_channels", "business", "hook", "variant", "first_line", "priority", "source", "stage",
      "reached_stage", "lost_reason", "next_step", "next_step_date", "deal_amount", "client_id",
      "stage_changed_at",
    ],
  },
  lead_touches: {
    columns: [...base, "lead_id", "type", "date", "comment", "created_at"],
    writable: ["lead_id", "type", "date", "comment"],
  },
};

/**
 * Колонки-ссылки на другие таблицы пользователя. Внешний ключ в Postgres не знает
 * про user_id, поэтому сервер сам проверяет, что ссылка ведёт на свою строку, —
 * иначе можно было бы привязать касание к чужому лиду.
 */
export const REFERENCES: Record<string, Record<string, string>> = {
  expenses: { recurring_id: "recurring_expenses" },
  incomes: { client_id: "clients" },
  leads: { client_id: "clients" },
  lead_touches: { lead_id: "leads" },
};
