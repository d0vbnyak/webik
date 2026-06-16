// Доменные типы админ-панели. Соответствуют таблицам Supabase (см. supabase/schema.sql).

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
  tax_rate: number; // %
  default_monthly_goal: number | null;
}

// Insert-типы: серверные поля (id/user_id/created_at) не передаём — их проставляет БД
// (user_id = auth.uid() по умолчанию).
export type NewClient = Omit<Client, "id" | "user_id" | "created_at">;
export type NewExpense = Omit<Expense, "id" | "user_id" | "created_at">;
export type NewIncome = Omit<Income, "id" | "user_id" | "created_at">;
export type NewRecurringExpense = Omit<RecurringExpense, "id" | "user_id" | "created_at">;
export type NewCategory = Omit<Category, "id" | "user_id">;
export type NewGoal = Omit<Goal, "id" | "user_id">;
