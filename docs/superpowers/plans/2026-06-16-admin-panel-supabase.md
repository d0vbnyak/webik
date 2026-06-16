# Закрытая админ-панель «Статистика» на Supabase — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Встроить в сайт WebIK закрытый раздел `/admin` для учёта расходов, доходов,
клиентов, повторяющихся расходов, целей и налогов с хранением в Supabase и защитой по RLS.

**Architecture:** Отдельная папка `src/admin/`, не затрагивающая основной сайт. Один
ленивый маршрут `/admin/*` в обход публичного `SiteLayout`. Тёмная тема, нижняя навигация
с иконками. Чистая денежно-датная логика вынесена в `lib/` и покрыта Vitest. Данные —
через типизированный Supabase-клиент и по одному хуку на сущность.

**Tech Stack:** React 19, React Router 7, TypeScript 5.9 (strict, verbatimModuleSyntax),
Vite 7, Tailwind 4, Motion 12, @supabase/supabase-js, recharts (lazy), Vitest.

**Источник истины по поведению:** `docs/superpowers/specs/2026-06-16-admin-panel-supabase-design.md`

---

## Соглашения для всех задач
- TS строгий: импорт типов только через `import type`; никаких неиспользуемых переменных/параметров.
- Деньги — `number` (рубли, 2 знака). Даты в БД — `date` (строка `YYYY-MM-DD`).
- Каждое обращение к Supabase — с `error`-обработкой и состояниями `loading`.
- Коммит после каждого зелёного шага. Git remote нет — только локальные коммиты.
- Тёмная палитра: фон `bg-zinc-950`, карточки `bg-zinc-900 border border-zinc-800 rounded-2xl`,
  акцент `text-brand-green` / `bg-brand-green text-black`, текст `text-zinc-100`, приглушённый `text-zinc-400`.

---

## Карта файлов
```
СОЗДАТЬ:
  vitest.config.ts
  .env.example
  supabase/schema.sql                      — SQL: таблицы + RLS + сиды
  src/admin/AdminApp.tsx                    — роутер + провайдеры
  src/admin/AdminLayout.tsx                 — оболочка + нижняя навигация
  src/admin/RequireAuth.tsx                 — guard
  src/admin/lib/types.ts                    — доменные типы + типы строк Supabase
  src/admin/lib/supabase.ts                 — типизированный клиент
  src/admin/lib/dates.ts (+ dates.test.ts)
  src/admin/lib/phone.ts (+ phone.test.ts)
  src/admin/lib/finance.ts (+ finance.test.ts)
  src/admin/lib/recurring.ts (+ recurring.test.ts)
  src/admin/context/AuthContext.tsx
  src/admin/context/PeriodContext.tsx
  src/admin/hooks/useAuth.ts
  src/admin/hooks/useCategories.ts
  src/admin/hooks/useSettings.ts
  src/admin/hooks/useClients.ts
  src/admin/hooks/useExpenses.ts
  src/admin/hooks/useIncomes.ts
  src/admin/hooks/useRecurring.ts
  src/admin/hooks/useGoals.ts
  src/admin/components/{Card,Field,MoneyInput,Modal,StatCard,ProgressBar,
                        BottomNav,MonthSwitcher,MessengerButtons,CategorySelect,
                        Spinner,ConfirmDelete}.tsx
  src/admin/pages/{Login,Dashboard,Incomes,Expenses,Recurring,Clients,Stats,Settings}.tsx
МОДИФИЦИРОВАТЬ:
  package.json            — deps + script "test"
  src/vite-env.d.ts       — типы import.meta.env
  .gitignore              — добавить .env
  src/App.tsx             — маршрут /admin/*
```

---

## Phase 0 — Инфраструктура

### Task 1: Зависимости, vitest, env, .gitignore

**Files:** Modify `package.json`, `src/vite-env.d.ts`, `.gitignore`; Create `vitest.config.ts`, `.env.example`

- [ ] **Step 1: Установить пакеты**
```bash
npm install @supabase/supabase-js recharts
npm install -D vitest
```

- [ ] **Step 2: Добавить скрипт test в package.json**
В `"scripts"` добавить: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 3: vitest.config.ts** (node-окружение, тестов с DOM нет)
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Типизировать env в src/vite-env.d.ts**
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 5: .env.example**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 6: Добавить .env в .gitignore**
Добавить строку `.env` (рядом с `*.local`).

- [ ] **Step 7: Проверить, что dev-сервер стартует**
Run: `npm run build` → Expected: успешная сборка (новые файлы ещё не подключены).

- [ ] **Step 8: Commit** — `chore(admin): зависимости, vitest, env-типы, .gitignore`

---

### Task 2: SQL-схема (таблицы + RLS + сиды)

**Files:** Create `supabase/schema.sql`

- [ ] **Step 1: Написать supabase/schema.sql**
Полный SQL: расширение `pgcrypto` (для `gen_random_uuid()`), 7 таблиц с `user_id uuid not null default auth.uid()`, FK `incomes.client_id → clients(id)`, `expenses.recurring_id → recurring_expenses(id)`; `alter table ... enable row level security`; на каждую таблицу 4 политики (`select/insert/update/delete`) с `using (auth.uid() = user_id)` и `with check (auth.uid() = user_id)`. Сиды (categories + settings) — как функция/`insert ... select` под конкретного пользователя ИЛИ как клиентский bootstrap (см. Task 13). В файле даём оба варианта сидов: SQL-вариант с подстановкой `auth.uid()` для ручного прогона и пометку, что приложение само досевает при первом входе.

(Полный текст SQL войдёт в финальную инструкцию пользователю; в файле — рабочий скрипт.)

- [ ] **Step 2: Проверка** — файл валиден визуально (выполнит пользователь в Supabase SQL Editor).

- [ ] **Step 3: Commit** — `feat(admin): SQL-схема Supabase с RLS и сидами`

---

## Phase 1 — Типы и клиент

### Task 3: Доменные типы и типы строк Supabase

**Files:** Create `src/admin/lib/types.ts`

- [ ] **Step 1: Написать типы**
```ts
export type PaymentStatus = "paid" | "unpaid" | "partial";
export type CategoryType = "expense" | "income";

export interface Client {
  id: string; user_id: string; name: string;
  phone: string | null; telegram_username: string | null; max_link: string | null;
  created_at: string;
}
export interface Expense {
  id: string; user_id: string; amount: number; date: string; category: string;
  comment: string | null; recurring_id: string | null; created_at: string;
}
export interface Income {
  id: string; user_id: string; amount: number; date: string; category: string;
  client_id: string | null; payment_status: PaymentStatus; paid_amount: number;
  due_date: string | null; comment: string | null; created_at: string;
}
export interface Category { id: string; user_id: string; type: CategoryType; name: string; }
export interface RecurringExpense {
  id: string; user_id: string; name: string; amount: number; category: string;
  next_charge_date: string; reminder_days_before: number; active: boolean; created_at: string;
}
export interface Goal { id: string; user_id: string; year: number; month: number; target_amount: number; }
export interface Settings {
  id: string; user_id: string; tax_rate: number; default_monthly_goal: number | null;
}

// Insert-типы: без серверных полей (id/user_id/created_at)
export type NewClient = Omit<Client, "id" | "user_id" | "created_at">;
export type NewExpense = Omit<Expense, "id" | "user_id" | "created_at">;
export type NewIncome = Omit<Income, "id" | "user_id" | "created_at">;
export type NewRecurringExpense = Omit<RecurringExpense, "id" | "user_id" | "created_at">;
export type NewCategory = Omit<Category, "id" | "user_id">;
export type NewGoal = Omit<Goal, "id" | "user_id">;
```

- [ ] **Step 2: Commit** — `feat(admin): доменные типы`

---

### Task 4: Типизированный Supabase-клиент

**Files:** Create `src/admin/lib/supabase.ts`

- [ ] **Step 1: Клиент**
```ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Понятная ошибка вместо «тихого» падения запросов
  console.error("Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY в .env");
}

export const supabase = createClient(url ?? "", anon ?? "");
```
(Запросы типизируем дженериками `.from("table").select()` + приведение к доменным типам в хуках.)

- [ ] **Step 2: Commit** — `feat(admin): supabase-клиент из env`

---

## Phase 2 — Чистая логика (TDD)

### Task 5: dates.ts — работа с месяцами/датами

**Files:** Create `src/admin/lib/dates.ts`, `src/admin/lib/dates.test.ts`

- [ ] **Step 1: Тесты (RED)** `dates.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { monthRange, addMonthISO, formatMoney, monthLabel } from "./dates";

describe("monthRange", () => {
  it("возвращает первый и следующий-первый день месяца (полуинтервал)", () => {
    expect(monthRange(2026, 2)).toEqual({ start: "2026-02-01", endExclusive: "2026-03-01" });
  });
  it("декабрь → переход через год", () => {
    expect(monthRange(2026, 12)).toEqual({ start: "2026-12-01", endExclusive: "2027-01-01" });
  });
});

describe("addMonthISO", () => {
  it("сдвигает дату на месяц вперёд", () => {
    expect(addMonthISO("2026-01-15")).toBe("2026-02-15");
  });
  it("31 января → 28 февраля (клампинг к концу месяца)", () => {
    expect(addMonthISO("2026-01-31")).toBe("2026-02-28");
  });
  it("декабрь → следующий год", () => {
    expect(addMonthISO("2026-12-10")).toBe("2027-01-10");
  });
});

describe("formatMoney", () => {
  it("форматирует рубли без копеек для целых", () => {
    expect(formatMoney(1500)).toBe("1 500 ₽");
  });
});

describe("monthLabel", () => {
  it("название месяца по-русски", () => {
    expect(monthLabel(2026, 6)).toBe("Июнь 2026");
  });
});
```

- [ ] **Step 2: Запуск (verify RED)** — `npm run test` → FAIL (функции не определены).

- [ ] **Step 3: Реализация (GREEN)** `dates.ts`
```ts
const pad = (n: number) => String(n).padStart(2, "0");

export function monthRange(year: number, month: number) {
  const start = `${year}-${pad(month)}-01`;
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  const endExclusive = `${ny}-${pad(nm)}-01`;
  return { start, endExclusive };
}

export function addMonthISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const lastDay = new Date(ny, nm, 0).getDate(); // день 0 след. месяца = последний день nm
  const day = Math.min(d, lastDay);
  return `${ny}-${pad(nm)}-${pad(day)}`;
}

const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export function formatMoney(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const hasFraction = rounded % 1 !== 0;
  return rounded.toLocaleString("ru-RU", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }) + " ₽";
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
```

- [ ] **Step 4: Запуск (verify GREEN)** — `npm run test` → PASS.

- [ ] **Step 5: Commit** — `feat(admin): dates.ts с тестами`

---

### Task 6: phone.ts — нормализация телефона и ссылки мессенджеров

**Files:** Create `src/admin/lib/phone.ts`, `src/admin/lib/phone.test.ts`

- [ ] **Step 1: Тесты (RED)** `phone.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { normalizePhone, whatsappLink, telegramLink, maxLinkOf, messengerLinks } from "./phone";

describe("normalizePhone", () => {
  it("убирает всё кроме цифр", () => {
    expect(normalizePhone("+7 (900) 123-45-67")).toBe("79001234567");
  });
  it("ведущая 8 (РФ) → 7", () => {
    expect(normalizePhone("8 (900) 123-45-67")).toBe("79001234567");
  });
  it("пустой/null → пустая строка", () => {
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone("")).toBe("");
  });
});

describe("whatsappLink", () => {
  it("по нормализованному номеру", () => {
    expect(whatsappLink("89001234567")).toBe("https://wa.me/79001234567");
  });
  it("нет телефона → null", () => {
    expect(whatsappLink("")).toBeNull();
  });
});

describe("telegramLink", () => {
  it("по username (приоритет)", () => {
    expect(telegramLink("ivan", "89001234567")).toBe("https://t.me/ivan");
  });
  it("без username, но с телефоном → tg://resolve", () => {
    expect(telegramLink(null, "89001234567")).toBe("tg://resolve?phone=79001234567");
  });
  it("ни того, ни другого → null", () => {
    expect(telegramLink(null, "")).toBeNull();
  });
});

describe("messengerLinks (видимость по правилам)", () => {
  it("только max_link → виден только MAX", () => {
    const r = messengerLinks({ phone: null, telegram_username: null, max_link: "https://max.ru/u/abc" });
    expect(r.whatsapp).toBeNull();
    expect(r.telegram).toBeNull();
    expect(r.max).toBe("https://max.ru/u/abc");
  });
});
```

- [ ] **Step 2: Запуск (verify RED)** — `npm run test` → FAIL.

- [ ] **Step 3: Реализация (GREEN)** `phone.ts`
```ts
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  return digits;
}

export function whatsappLink(rawPhone: string | null | undefined): string | null {
  const n = normalizePhone(rawPhone);
  return n ? `https://wa.me/${n}` : null;
}

export function telegramLink(
  username: string | null | undefined,
  rawPhone: string | null | undefined,
): string | null {
  const u = username?.trim().replace(/^@/, "");
  if (u) return `https://t.me/${u}`;
  const n = normalizePhone(rawPhone);
  return n ? `tg://resolve?phone=${n}` : null;
}

export function maxLinkOf(max_link: string | null | undefined): string | null {
  const m = max_link?.trim();
  return m ? m : null;
}

export function messengerLinks(c: {
  phone: string | null; telegram_username: string | null; max_link: string | null;
}) {
  return {
    whatsapp: whatsappLink(c.phone),
    telegram: telegramLink(c.telegram_username, c.phone),
    max: maxLinkOf(c.max_link),
  };
}
```

- [ ] **Step 4: Запуск (verify GREEN)** — `npm run test` → PASS.

- [ ] **Step 5: Commit** — `feat(admin): phone.ts (нормализация + мессенджеры) с тестами`

---

### Task 7: finance.ts — остаток, просрочка, налог, агрегаты

**Files:** Create `src/admin/lib/finance.ts`, `src/admin/lib/finance.test.ts`

- [ ] **Step 1: Тесты (RED)** `finance.test.ts`
```ts
import { describe, it, expect } from "vitest";
import type { Income } from "./types";
import { remainingToPay, isOverdue, taxReserve, normalizePaidAmount } from "./finance";

const inc = (p: Partial<Income>): Income => ({
  id: "1", user_id: "u", amount: 1000, date: "2026-06-01", category: "Веб",
  client_id: null, payment_status: "unpaid", paid_amount: 0, due_date: null,
  comment: null, created_at: "", ...p,
});

describe("remainingToPay", () => {
  it("amount − paid_amount", () => {
    expect(remainingToPay(inc({ amount: 1000, paid_amount: 300 }))).toBe(700);
  });
  it("не отрицательный", () => {
    expect(remainingToPay(inc({ amount: 1000, paid_amount: 1500 }))).toBe(0);
  });
});

describe("isOverdue", () => {
  it("due_date в прошлом и не оплачено полностью", () => {
    expect(isOverdue(inc({ due_date: "2026-06-01", payment_status: "partial", paid_amount: 100, amount: 1000 }), "2026-06-16")).toBe(true);
  });
  it("оплачено полностью → не просрочено", () => {
    expect(isOverdue(inc({ due_date: "2026-06-01", payment_status: "paid", paid_amount: 1000, amount: 1000 }), "2026-06-16")).toBe(false);
  });
  it("нет due_date → не просрочено", () => {
    expect(isOverdue(inc({ due_date: null }), "2026-06-16")).toBe(false);
  });
  it("due_date сегодня → ещё не просрочено", () => {
    expect(isOverdue(inc({ due_date: "2026-06-16", paid_amount: 0 }), "2026-06-16")).toBe(false);
  });
});

describe("taxReserve", () => {
  it("ставка% от суммы полученного (paid_amount)", () => {
    expect(taxReserve(50000, 6)).toBe(3000);
  });
});

describe("normalizePaidAmount", () => {
  it("статус paid → paid_amount = amount", () => {
    expect(normalizePaidAmount("paid", 1000, 0)).toBe(1000);
  });
  it("статус unpaid → 0", () => {
    expect(normalizePaidAmount("unpaid", 1000, 500)).toBe(0);
  });
  it("статус partial → как введено", () => {
    expect(normalizePaidAmount("partial", 1000, 400)).toBe(400);
  });
});
```

- [ ] **Step 2: Запуск (verify RED)** — `npm run test` → FAIL.

- [ ] **Step 3: Реализация (GREEN)** `finance.ts`
```ts
import type { Income, PaymentStatus } from "./types";

export function remainingToPay(i: Pick<Income, "amount" | "paid_amount">): number {
  return Math.max(0, i.amount - i.paid_amount);
}

export function isOverdue(
  i: Pick<Income, "due_date" | "amount" | "paid_amount">,
  todayIso: string,
): boolean {
  if (!i.due_date) return false;
  if (remainingToPay(i) <= 0) return false;
  return i.due_date < todayIso;
}

export function taxReserve(receivedTotal: number, taxRatePercent: number): number {
  return Math.round(receivedTotal * (taxRatePercent / 100) * 100) / 100;
}

export function normalizePaidAmount(
  status: PaymentStatus, amount: number, paidInput: number,
): number {
  if (status === "paid") return amount;
  if (status === "unpaid") return 0;
  return paidInput;
}
```

- [ ] **Step 4: Запуск (verify GREEN)** — `npm run test` → PASS.

- [ ] **Step 5: Commit** — `feat(admin): finance.ts (остаток/просрочка/налог) с тестами`

---

### Task 8: recurring.ts — авто-добавление и напоминания

**Files:** Create `src/admin/lib/recurring.ts`, `src/admin/lib/recurring.test.ts`

- [ ] **Step 1: Тесты (RED)** `recurring.test.ts`
```ts
import { describe, it, expect } from "vitest";
import type { RecurringExpense } from "./types";
import { computeDueCharges, daysUntil, shouldRemind } from "./recurring";

const tpl = (p: Partial<RecurringExpense>): RecurringExpense => ({
  id: "r1", user_id: "u", name: "Хостинг", amount: 500, category: "Сервисы и подписки",
  next_charge_date: "2026-06-01", reminder_days_before: 3, active: true, created_at: "", ...p,
});

describe("computeDueCharges", () => {
  it("создаёт по одному списанию за каждый просроченный месяц и двигает дату вперёд", () => {
    const r = computeDueCharges(tpl({ next_charge_date: "2026-04-10" }), "2026-06-16", []);
    expect(r.charges.map((c) => c.date)).toEqual(["2026-04-10", "2026-05-10", "2026-06-10"]);
    expect(r.nextChargeDate).toBe("2026-07-10");
  });
  it("дата в будущем → ничего не создаём", () => {
    const r = computeDueCharges(tpl({ next_charge_date: "2026-07-01" }), "2026-06-16", []);
    expect(r.charges).toEqual([]);
    expect(r.nextChargeDate).toBe("2026-07-01");
  });
  it("дедуп: пропускаем даты, на которые расход с этим recurring_id уже есть", () => {
    const r = computeDueCharges(tpl({ next_charge_date: "2026-04-10" }), "2026-06-16", ["2026-05-10"]);
    expect(r.charges.map((c) => c.date)).toEqual(["2026-04-10", "2026-06-10"]);
    expect(r.nextChargeDate).toBe("2026-07-10");
  });
});

describe("daysUntil / shouldRemind", () => {
  it("дней до даты", () => {
    expect(daysUntil("2026-06-19", "2026-06-16")).toBe(3);
  });
  it("напоминание, если осталось <= reminder_days_before и дата не в прошлом", () => {
    expect(shouldRemind(tpl({ next_charge_date: "2026-06-18", reminder_days_before: 3 }), "2026-06-16")).toBe(true);
    expect(shouldRemind(tpl({ next_charge_date: "2026-06-25", reminder_days_before: 3 }), "2026-06-16")).toBe(false);
    expect(shouldRemind(tpl({ active: false, next_charge_date: "2026-06-18" }), "2026-06-16")).toBe(false);
  });
});
```

- [ ] **Step 2: Запуск (verify RED)** — `npm run test` → FAIL.

- [ ] **Step 3: Реализация (GREEN)** `recurring.ts`
```ts
import type { RecurringExpense } from "./types";
import { addMonthISO } from "./dates";

export interface DueCharge { date: string; }
export interface ComputedCharges { charges: DueCharge[]; nextChargeDate: string; }

/**
 * Считает, какие списания нужно добавить, пока next_charge_date <= сегодня.
 * existingDates — даты уже существующих расходов с этим recurring_id (дедуп).
 * Дата всегда двигается вперёд (даже если конкретное списание пропущено по дедупу).
 */
export function computeDueCharges(
  tpl: RecurringExpense, todayIso: string, existingDates: string[],
): ComputedCharges {
  const existing = new Set(existingDates);
  const charges: DueCharge[] = [];
  let date = tpl.next_charge_date;
  // защита от бесконечного цикла на некорректных данных
  let guard = 0;
  while (date <= todayIso && guard < 600) {
    if (!existing.has(date)) charges.push({ date });
    date = addMonthISO(date);
    guard++;
  }
  return { charges, nextChargeDate: date };
}

export function daysUntil(targetIso: string, todayIso: string): number {
  const [ty, tm, td] = targetIso.split("-").map(Number);
  const [ny, nm, nd] = todayIso.split("-").map(Number);
  const a = Date.UTC(ty, tm - 1, td);
  const b = Date.UTC(ny, nm - 1, nd);
  return Math.round((a - b) / 86_400_000);
}

export function shouldRemind(tpl: RecurringExpense, todayIso: string): boolean {
  if (!tpl.active) return false;
  const left = daysUntil(tpl.next_charge_date, todayIso);
  return left >= 0 && left <= tpl.reminder_days_before;
}
```

- [ ] **Step 4: Запуск (verify GREEN)** — `npm run test` → PASS.

- [ ] **Step 5: Commit** — `feat(admin): recurring.ts (авто-добавление + напоминания) с тестами`

---

## Phase 3 — Авторизация и оболочка

### Task 9: AuthContext + useAuth

**Files:** Create `src/admin/context/AuthContext.tsx`, `src/admin/hooks/useAuth.ts`

- [ ] **Step 1: AuthContext.tsx** — провайдер с состоянием `{ session, user, loading }` и методами `signIn(email,password)`, `signOut()`.
```tsx
import { createContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthValue {
  session: Session | null; user: User | null; loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}
export const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }
  async function signOut() { await supabase.auth.signOut(); }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 2: useAuth.ts**
```ts
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth должен использоваться внутри AuthProvider");
  return ctx;
}
```

- [ ] **Step 3: Commit** — `feat(admin): AuthContext + useAuth`

---

### Task 10: RequireAuth guard

**Files:** Create `src/admin/RequireAuth.tsx`

- [ ] **Step 1: RequireAuth.tsx**
```tsx
import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "./hooks/useAuth";
import Spinner from "./components/Spinner";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <Spinner full />;
  if (!session) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 2: Commit** — `feat(admin): RequireAuth guard` (после Spinner — Task 16; временно допускается локальный спиннер, либо переставить порядок).

---

### Task 11: PeriodContext + MonthSwitcher + AdminLayout + BottomNav

**Files:** Create `src/admin/context/PeriodContext.tsx`, `src/admin/components/MonthSwitcher.tsx`, `src/admin/components/BottomNav.tsx`, `src/admin/AdminLayout.tsx`

- [ ] **Step 1: PeriodContext.tsx** — хранит `{ year, month }` (по умолчанию текущие) + `setPeriod`, `prevMonth`, `nextMonth`. Текущие год/месяц берём из `todayISO()`.

- [ ] **Step 2: MonthSwitcher.tsx** — стрелки ‹ › + `monthLabel(year,month)` + `<select>` года и месяца (любой прошлый). Использует PeriodContext.

- [ ] **Step 3: BottomNav.tsx** — фиксированная нижняя панель `fixed bottom-0`, иконки-ссылки `NavLink` на: Дашборд, Доходы, Расходы, Повторяющиеся, Клиенты, Статистика, Настройки. Иконки — inline-SVG (без новых зависимостей). Активный пункт — `text-brand-green`. На мобильном только иконки; на `sm:` можно показать подпись под иконкой. Корректный `pb` у контента, чтобы панель не перекрывала.

- [ ] **Step 4: AdminLayout.tsx** — тёмный фон `min-h-screen bg-zinc-950 text-zinc-100`, контент `max-w-3xl mx-auto px-4 pt-6 pb-28`, шапка с `MonthSwitcher` (на дашборде/статистике) и кнопкой выхода; снизу — `<BottomNav/>`. Рендерит `<Outlet/>`.

- [ ] **Step 5: Проверка** — `npm run build` (после Task 12, когда подключим в App).

- [ ] **Step 6: Commit** — `feat(admin): оболочка, нижняя навигация, переключатель месяца`

---

### Task 12: AdminApp + интеграция в роутер

**Files:** Create `src/admin/AdminApp.tsx`; Modify `src/App.tsx`

- [ ] **Step 1: AdminApp.tsx** — оборачивает в `AuthProvider` и `PeriodProvider`, объявляет `<Routes>`:
```tsx
// /admin/login — публичный; остальное — внутри RequireAuth + AdminLayout
<Routes>
  <Route path="login" element={<Login />} />
  <Route element={<RequireAuth><AdminLayout /></RequireAuth>}>
    <Route index element={<Dashboard />} />
    <Route path="incomes" element={<Incomes />} />
    <Route path="expenses" element={<Expenses />} />
    <Route path="recurring" element={<Recurring />} />
    <Route path="clients" element={<Clients />} />
    <Route path="stats" element={<Stats />} />
    <Route path="settings" element={<Settings />} />
  </Route>
  <Route path="*" element={<Navigate to="/admin" replace />} />
</Routes>
```

- [ ] **Step 2: Подключить в src/App.tsx** — добавить ленивый импорт `const AdminApp = lazy(() => import("./admin/AdminApp"))` и в верхнем `<Routes>` маршрут:
```tsx
<Route path="/admin/*" element={
  <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}><AdminApp /></Suspense>
} />
```
(добавить ПЕРЕД `<Route path="/*" element={<SiteLayout />} />`).

- [ ] **Step 3: Проверка** — `npm run build` → PASS; dev → `/admin/login` открывается, `/admin` без сессии редиректит на login.

- [ ] **Step 4: Commit** — `feat(admin): роутер админки + интеграция в App`

---

## Phase 4 — Хуки данных

### Task 13: useCategories + useSettings (с сидами при первом входе)

**Files:** Create `src/admin/hooks/useCategories.ts`, `src/admin/hooks/useSettings.ts`

- [ ] **Step 1: useSettings.ts** — `select` строки settings пользователя; если её нет — `insert { tax_rate: 6, default_monthly_goal: null }` и вернуть. Экспонирует `{ settings, loading, error, update(patch) }`.

- [ ] **Step 2: useCategories.ts** — `select` категорий; если их нет вообще — засеять дефолт (expense: Реклама, ИИ, Сервисы и подписки, Прочее; income: Веб, Боты, SEO) одним `insert` массивом, затем перечитать. Экспонирует `{ categories, byType(type), loading, error, addCategory(type,name), removeCategory(id) }`.

- [ ] **Step 3: Проверка** — `npm run build` → PASS.

- [ ] **Step 4: Commit** — `feat(admin): хуки настроек и категорий с сидами`

---

### Task 14: useClients, useExpenses, useIncomes, useRecurring, useGoals

**Files:** Create соответствующие файлы в `src/admin/hooks/`

Общий паттерн каждого хука: состояние `{ items, loading, error }`, `useEffect` грузит при монтировании (и при смене периода, где это нужно), CRUD-методы делают мутацию и оптимистично/перечтением обновляют список.

- [ ] **Step 1: useExpenses.ts** — принимает `{ year, month }`; `select` с `.gte("date", start).lt("date", endExclusive)` (через `monthRange`), сортировка по `date desc`. Методы `add(NewExpense)`, `update(id, patch)`, `remove(id)`. Также метод/функция для добавления авто-списаний из Task 18 (`addMany(NewExpense[])`).

- [ ] **Step 2: useIncomes.ts** — аналогично с фильтром по месяцу; метод `markPaid(id)` (ставит `payment_status:'paid', paid_amount: amount`). Дополнительно — отдельный запрос `fetchOutstanding()` для дебиторки (все неоплаченные/частичные, без фильтра по месяцу).

- [ ] **Step 3: useClients.ts** — CRUD, сортировка по `name`.

- [ ] **Step 4: useRecurring.ts** — CRUD шаблонов; метод `update(id, patch)` (для сдвига `next_charge_date` и toggle `active`).

- [ ] **Step 5: useGoals.ts** — `getGoal(year,month)`, `setGoal(year,month,target_amount)` (upsert по уникальной паре).

- [ ] **Step 6: Проверка** — `npm run build` → PASS.

- [ ] **Step 7: Commit** — `feat(admin): хуки данных (clients/expenses/incomes/recurring/goals)`

---

## Phase 5 — Страницы и компоненты UI

### Task 15: Login

**Files:** Create `src/admin/pages/Login.tsx`

- [ ] **Step 1:** Форма email+пароль, `signIn`, показ ошибки, спиннер при отправке; при успешной сессии — `Navigate` на `/admin`. Если сессия уже есть — сразу редирект. Тёмная карточка по центру, акцент brand-green на кнопке.
- [ ] **Step 2: Проверка** — dev: неверный пароль показывает ошибку (после создания аккаунта пользователем).
- [ ] **Step 3: Commit** — `feat(admin): страница входа`

---

### Task 16: Общие UI-компоненты

**Files:** Create `Card, Field, MoneyInput, Modal, StatCard, ProgressBar, Spinner, ConfirmDelete, CategorySelect, MessengerButtons` в `src/admin/components/`

- [ ] **Step 1:** Набор тёмных переиспользуемых компонентов:
  - `Spinner({full?})` — крутилка; `full` — на весь экран.
  - `Card` — обёртка `bg-zinc-900 border border-zinc-800 rounded-2xl p-4`.
  - `Field` — label + control + текст ошибки.
  - `MoneyInput` — `inputMode="decimal"`, парс в число, не допускает отрицательных.
  - `Modal` — затемнение + центр, закрытие по Esc/клику вне; для форм добавления/редактирования.
  - `StatCard` — заголовок + крупное значение `formatMoney` + опц. подпись/цвет.
  - `ProgressBar` — полоса `value/target`, % и «осталось N», цвет brand-green.
  - `ConfirmDelete` — кнопка с подтверждением удаления.
  - `CategorySelect` — `<select>` из категорий нужного типа + «+ Добавить» (инлайн-ввод → `addCategory`).
  - `MessengerButtons` — принимает клиента, через `messengerLinks` рисует только доступные иконки WA/TG/MAX, все ссылки `target="_blank" rel="noopener noreferrer"`.
- [ ] **Step 2: Проверка** — `npm run build` → PASS.
- [ ] **Step 3: Commit** — `feat(admin): общие UI-компоненты`

---

### Task 17: Expenses (расходы)

**Files:** Create `src/admin/pages/Expenses.tsx`

- [ ] **Step 1:** Форма (Modal) добавления/редактирования: сумма (`MoneyInput`, >0), дата (`todayISO` по умолчанию), категория (`CategorySelect` type='expense'), комментарий. Список расходов выбранного месяца (из `useExpenses`) с суммой, категорией, датой, комментарием; кнопки «редактировать»/«удалить» (`ConfirmDelete`). Внизу — итог за месяц.
- [ ] **Step 2: Проверка** — браузер: добавление/редактирование/удаление работает, валидация суммы.
- [ ] **Step 3: Commit** — `feat(admin): раздел расходов`

---

### Task 18: Recurring (повторяющиеся) + авто-добавление при загрузке

**Files:** Create `src/admin/pages/Recurring.tsx`; Modify `src/admin/AdminApp.tsx` (bootstrap)

- [ ] **Step 1:** Страница шаблонов: CRUD (название, сумма, категория, `next_charge_date`, `reminder_days_before`, `active` toggle). Список с пометкой ближайшего списания.
- [ ] **Step 2: Bootstrap авто-добавления** — в защищённой области (например, компонент `RecurringBootstrap`, монтируется в AdminLayout после авторизации): один раз за загрузку для каждого активного шаблона:
  1. прочитать существующие расходы с этим `recurring_id` (их даты);
  2. `computeDueCharges(tpl, todayISO(), existingDates)`;
  3. если `charges` непусты — `expenses.addMany(...)` (с `recurring_id`, категорией и суммой шаблона) и `recurring.update(id, { next_charge_date: nextChargeDate })`.
  Выполнять последовательно по шаблонам; ошибки логировать, не блокировать UI.
- [ ] **Step 3: Проверка** — браузер: шаблон с прошедшей датой при заходе создаёт расход(ы) и сдвигает дату; повторный заход не дублирует.
- [ ] **Step 4: Commit** — `feat(admin): повторяющиеся расходы + авто-добавление`

---

### Task 19: Incomes (доходы) + дебиторка

**Files:** Create `src/admin/pages/Incomes.tsx`

- [ ] **Step 1:** Форма: сумма (>0), дата, категория (type='income'), клиент (опц., из `useClients`), комментарий, статус (`paid`/`unpaid`/`partial`), `paid_amount` (через `normalizePaidAmount` от статуса; поле активно только при `partial`), `due_date` (опц.). Список месяца с фильтром по статусу; «просрочено» (`isOverdue` от `todayISO`) подсвечено; быстрая отметка «оплачено» (`markPaid`).
- [ ] **Step 2: Виджет дебиторки** — на этой же странице блок «Кто должен»: все неоплаченные/частичные (`fetchOutstanding`), остаток (`remainingToPay`), просроченные подсвечены, кнопка «оплачено».
- [ ] **Step 3: Проверка** — браузер: статусы, paid_amount-логика, фильтр, просрочка, отметка оплаты.
- [ ] **Step 4: Commit** — `feat(admin): раздел доходов + дебиторка`

---

### Task 20: Clients (клиенты)

**Files:** Create `src/admin/pages/Clients.tsx`

- [ ] **Step 1:** Форма: имя (обязательно), телефон (опц.), telegram_username (опц., вход без `@`), max_link (опц.). Список клиентов с `MessengerButtons` у каждого; редактирование/удаление.
- [ ] **Step 2: Проверка** — браузер: кнопки мессенджеров появляются строго по правилам; ссылки корректны.
- [ ] **Step 3: Commit** — `feat(admin): раздел клиентов`

---

### Task 21: Settings + Goals (цели)

**Files:** Create `src/admin/pages/Settings.tsx`

- [ ] **Step 1:** Настройки: `tax_rate` (%), `default_monthly_goal` (опц.). Управление категориями (добавить/удалить для обоих типов). Цель на конкретный месяц: выбор года/месяца + `target_amount` через `useGoals.setGoal`.
- [ ] **Step 2: Проверка** — браузер: сохранение настроек и цели.
- [ ] **Step 3: Commit** — `feat(admin): настройки, категории, цели`

---

### Task 22: Dashboard (дашборд)

**Files:** Create `src/admin/pages/Dashboard.tsx`

- [ ] **Step 1:** За выбранный месяц (PeriodContext): доход (Σ amount доходов месяца), получено (Σ paid_amount), дебиторка (Σ remainingToPay по неоплаченным/частичным), расход (Σ месяца), прибыль (доход − расход), резерв на налог (`taxReserve(Σ paid_amount, settings.tax_rate)`). Прогресс к цели (`ProgressBar`): цель = goal месяца или `default_monthly_goal`; база прогресса — полученный доход. Ближайшие/просроченные платежи (из дебиторки). Напоминания по повторяющимся (`shouldRemind`).
- [ ] **Step 2: Проверка** — браузер: цифры сходятся с введёнными данными; переключение месяца меняет дашборд.
- [ ] **Step 3: Commit** — `feat(admin): дашборд`

---

### Task 23: Stats (статистика) + recharts (lazy)

**Files:** Create `src/admin/pages/Stats.tsx`, `src/admin/components/MonthlyChart.tsx`

- [ ] **Step 1:** Сводка месяца (доход/расход/прибыль), разбивка доходов по категориям и расходов по категориям (списки с суммами/долями). 
- [ ] **Step 2: MonthlyChart.tsx** — recharts `LineChart` (доход/расход/прибыль за последние ~12 месяцев), грузится через `lazy` + `Suspense` только здесь. Данные — отдельный запрос диапазона 12 месяцев, агрегирование по месяцам на клиенте.
- [ ] **Step 3: Проверка** — `npm run build` (recharts в admin-чанке, не в основном бандле) + браузер: график рисуется, адаптивен.
- [ ] **Step 4: Commit** — `feat(admin): статистика + график динамики`

---

## Phase 6 — Проверка, ревью, инструкция

### Task 24: Полная проверка

- [ ] **Step 1:** `npm run test` → все тесты PASS.
- [ ] **Step 2:** `npm run build` → PASS, без TS-ошибок; проверить, что recharts не попал в основной бандл (отдельный admin-чанк).
- [ ] **Step 3:** Браузер (mobile + desktop): прогон ключевых сценариев из spec; нижняя навигация и переключатель месяца работают на обоих.
- [ ] **Step 4:** `superpowers:verification-before-completion` — зафиксировать вывод команд.

### Task 25: Код-ревью (второй Opus)

- [ ] **Step 1:** `superpowers:requesting-code-review` — независимый Opus-ревьюер получает git-диапазон и spec, без истории чата. Исправить критичные/важные замечания (при необходимости — повторно).

### Task 26: Инструкция пользователю + закрытие epic

- [ ] **Step 1:** Выдать пользователю в ответе: (1) npm-пакеты; (2) полный SQL (таблицы+RLS+сиды); (3) переменные .env, где взять, что .env в .gitignore; (4) как отключить публичную регистрацию и создать аккаунт вручную; (5) куда вписаны маршруты; (6) как работает авто-добавление и почему фоновые напоминания требуют планировщика.
- [ ] **Step 2:** После одобрения пользователя — `bd close WebIK-cvn --reason "..."` и закрыть под-задачи.

---

## Self-Review (покрытие спецификации)
- Расходы (форма/список/CRUD) → Task 17. Повторяющиеся + авто-добавление + напоминания → Task 8, 18, 22.
- Доходы (статусы/paid_amount/просрочка/фильтр) → Task 7, 19. Дебиторка → Task 19.
- Клиенты + мессенджеры (нормализация, правила видимости) → Task 6, 20.
- Цели + прогресс → Task 14, 21, 22. Налоги → Task 7, 22.
- Дашборд → Task 22. Статистика + график → Task 23.
- Auth + guard + маршруты → Task 9–12. RLS + схема + сиды → Task 2, 13.
- Типизация → Task 3. Env + клиент → Task 1, 4. Тесты → Task 5–8.
- Инструкция (6 пунктов) → Task 26.
