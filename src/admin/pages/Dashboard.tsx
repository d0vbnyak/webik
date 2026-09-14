import { Link } from "react-router";
import { usePeriod } from "../context/PeriodContext";
import { useIncomes } from "../hooks/useIncomes";
import { useExpenses } from "../hooks/useExpenses";
import { useReceivables } from "../hooks/useReceivables";
import { useSettings } from "../hooks/useSettings";
import { useGoals } from "../hooks/useGoals";
import { useRecurring } from "../hooks/useRecurring";
import { useLeads } from "../hooks/useLeads";
import { dueToday } from "../lib/crm";
import { formatMoney, formatDate, monthLabel, todayISO } from "../lib/dates";
import { remainingToPay, isOverdue, taxReserve } from "../lib/finance";
import { shouldRemind, daysUntil } from "../lib/recurring";
import MonthSwitcher from "../components/MonthSwitcher";
import StatCard from "../components/StatCard";
import ProgressBar from "../components/ProgressBar";
import Card from "../components/Card";
import Spinner from "../components/Spinner";

export default function Dashboard() {
  const today = todayISO();
  const { year, month } = usePeriod();
  const incomesHook = useIncomes(year, month);
  const expensesHook = useExpenses(year, month);
  const receivables = useReceivables();
  const { settings } = useSettings();
  const { getGoal } = useGoals();
  const { recurring } = useRecurring();
  const leadsHook = useLeads();

  const loading = incomesHook.loading || expensesHook.loading;

  const monthIncome = incomesHook.incomes.reduce((s, i) => s + i.amount, 0);
  const received = incomesHook.incomes.reduce((s, i) => s + i.paid_amount, 0);
  const monthExpenses = expensesHook.total;
  const profit = monthIncome - monthExpenses;
  const taxRate = settings?.tax_rate ?? 6;
  const tax = taxReserve(received, taxRate);
  const receivablesTotal = receivables.items.reduce((s, i) => s + remainingToPay(i), 0);
  const goal = getGoal(year, month)?.target_amount ?? settings?.default_monthly_goal ?? 0;

  // Ближайшие и просроченные платежи: просроченные выше, затем по дате
  const payments = [...receivables.items]
    .filter((i) => i.due_date)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .sort((a, b) => Number(isOverdue(b, today)) - Number(isOverdue(a, today)))
    .slice(0, 6);

  const reminders = recurring.filter((r) => shouldRemind(r, today));
  const crmToday = dueToday(leadsHook.leads, today);
  const crmOverdue = crmToday.filter((l) => (l.next_step_date ?? "") < today).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Дашборд <span className="text-sm font-normal text-zinc-500">· {monthLabel(year, month)}</span>
        </h1>
        <MonthSwitcher />
      </div>

      {loading ? (
        <div className="py-10 text-center"><Spinner /></div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Доход за месяц" amount={monthIncome} />
            <StatCard label="Получено" amount={received} tone="text-brand-green" />
            <StatCard label="Дебиторка" amount={receivablesTotal} tone={receivablesTotal > 0 ? "text-amber-400" : undefined} />
            <StatCard label="Расход за месяц" amount={monthExpenses} />
            <StatCard label="Прибыль" amount={profit} tone={profit >= 0 ? "text-brand-green" : "text-red-400"} />
            <StatCard label={`На налог (${taxRate}%)`} amount={tax} hint="отложить с полученного" />
          </div>

          <Link to="/admin/crm" className="block">
            <Card className="transition hover:border-zinc-600">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold">Воронка на сегодня</h2>
                  <p className="mt-0.5 text-sm text-zinc-400">
                    {leadsHook.loading
                      ? "…"
                      : crmToday.length === 0
                        ? "Дел по лидам нет"
                        : `${crmToday.length} дел` + (crmOverdue ? ` · ${crmOverdue} просрочено` : "")}
                  </p>
                </div>
                <span className={`font-display text-2xl font-semibold ${crmOverdue ? "text-red-400" : "text-brand-green"}`}>
                  {leadsHook.loading ? "" : crmToday.length}
                </span>
              </div>
            </Card>
          </Link>

          <Card>
            <h2 className="mb-3 font-display text-base font-semibold">Цель по доходу</h2>
            {/* База прогресса — полученный доход (Σ paid_amount), а не выставленный */}
            <ProgressBar value={received} target={goal} />
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <h2 className="mb-2 font-display text-base font-semibold">Ближайшие платежи</h2>
              {payments.length === 0 ? (
                <p className="py-2 text-sm text-zinc-500">Нет ожидаемых платежей.</p>
              ) : (
                <ul className="space-y-1.5">
                  {payments.map((i) => {
                    const overdue = isOverdue(i, today);
                    return (
                      <li key={i.id} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-300">{formatMoney(remainingToPay(i))}</span>
                        <span className={overdue ? "text-red-400" : "text-zinc-500"}>
                          {i.due_date ? formatDate(i.due_date) : ""}
                          {overdue ? " · просрочено" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-2 font-display text-base font-semibold">Напоминания по подпискам</h2>
              {reminders.length === 0 ? (
                <p className="py-2 text-sm text-zinc-500">Ближайших списаний нет.</p>
              ) : (
                <ul className="space-y-1.5">
                  {reminders.map((r) => {
                    const left = daysUntil(r.next_charge_date, today);
                    return (
                      <li key={r.id} className="flex items-center justify-between text-sm">
                        <span className="truncate text-zinc-300">
                          {r.name} <span className="text-zinc-500">· {formatMoney(r.amount)}</span>
                        </span>
                        <span className="shrink-0 text-amber-400">
                          {left === 0 ? "сегодня" : `через ${left} дн.`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
