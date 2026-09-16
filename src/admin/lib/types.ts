// Доменные типы админ-панели. Соответствуют таблицам базы (см. server/db/migrations).

export type PaymentStatus = "paid" | "unpaid" | "partial";
export type CategoryType = "expense" | "income";

export interface Client {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  telegram_username: string | null;
  max_link: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  comment: string | null;
  recurring_id: string | null;
  created_at: string;
}

export interface Income {
  id: string;
  user_id: string;
  amount: number; // полная стоимость работы
  date: string; // YYYY-MM-DD
  category: string;
  client_id: string | null;
  payment_status: PaymentStatus;
  paid_amount: number;
  due_date: string | null; // YYYY-MM-DD
  comment: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  type: CategoryType;
  name: string;
}

export interface RecurringExpense {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category: string;
  next_charge_date: string; // YYYY-MM-DD
  reminder_days_before: number;
  active: boolean;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  year: number;
  month: number; // 1-12
  target_amount: number;
}

export interface Settings {
  id: string;
  user_id: string;
  tax_rate: number; // полная ставка, %
  tax_reduced_rate: number; // ставка, пока не израсходован вычет, %
  tax_deduction_start: number; // остаток вычета на начало учёта, ₽
  default_monthly_goal: number | null;
}

// ---- CRM: воронка продаж ----

export type LeadStage =
  | "new"
  | "sent"
  | "followup"
  | "replied"
  | "check"
  | "call"
  | "proposal"
  | "pilot"
  | "client"
  | "support"
  | "lost";

export type LostReason =
  | "not_fit"
  | "private"
  | "not_sold"
  | "volume"
  | "price"
  | "timing"
  | "decision_maker"
  | "trust"
  | "data"
  | "competitor"
  | "ghosted"
  | "no_reply";

export interface Lead {
  id: string;
  user_id: string;
  company: string;
  inn: string | null;
  city: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  telegram_username: string | null;
  other_channels: string | null;
  business: string | null; // чем занимаются
  hook: string | null; // зацепка с сайта
  variant: string | null; // вариант письма: А / Б / В
  first_line: string | null; // первая строка письма
  priority: number | null; // 1 — прямо под наши кейсы, 2 — осторожнее
  source: string | null;
  stage: LeadStage;
  reached_stage: Exclude<LeadStage, "lost">; // самый дальний этап — для конверсий
  lost_reason: LostReason | null;
  next_step: string | null;
  next_step_date: string | null; // YYYY-MM-DD
  deal_amount: number | null; // ожидаемая сумма сделки
  client_id: string | null;
  stage_changed_at: string;
  created_at: string;
}

export type TouchType = "email" | "followup" | "call" | "meeting" | "message" | "proposal" | "note" | "stage";

export interface LeadTouch {
  id: string;
  user_id: string;
  lead_id: string;
  type: TouchType;
  date: string; // YYYY-MM-DD
  comment: string | null;
  created_at: string;
}

// Insert-типы: серверные поля (id/user_id/created_at) не передаём — их проставляет БД
// (user_id = auth.uid() по умолчанию).
export type NewClient = Omit<Client, "id" | "user_id" | "created_at">;
export type NewExpense = Omit<Expense, "id" | "user_id" | "created_at">;
export type NewIncome = Omit<Income, "id" | "user_id" | "created_at">;
export type NewRecurringExpense = Omit<RecurringExpense, "id" | "user_id" | "created_at">;
export type NewCategory = Omit<Category, "id" | "user_id">;
export type NewGoal = Omit<Goal, "id" | "user_id">;
export type NewLead = Omit<Lead, "id" | "user_id" | "created_at" | "stage_changed_at">;
export type NewLeadTouch = Omit<LeadTouch, "id" | "user_id" | "created_at">;
