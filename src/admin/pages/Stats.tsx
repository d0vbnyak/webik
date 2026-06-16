import { lazy, Suspense } from "react";
import { usePeriod } from "../context/PeriodContext";
import { useIncomes } from "../hooks/useIncomes";
import { useExpenses } from "../hooks/useExpenses";
import { formatMoney, monthLabel } from "../lib/dates";
import MonthSwitcher from "../components/MonthSwitcher";
import StatCard from "../components/StatCard";
import Card from "../components/Card";
import Spinner from "../components/Spinner";

// recharts грузится лениво — только при открытии статистики
const MonthlyChart = lazy(() => import("../components/MonthlyChart"));

function breakdown(items: { category: string; amount: number }[]) {
  const map = new Map<string, number>();
  for (const it of items) map.set(it.category, (map.get(it.category) ?? 0) + it.amount);
  const total = [...map.values()].reduce((s, v) => s + v, 0);
  const rows = [...map.entries()]
    .map(([category, amount]) => ({ category, amount, pct: total ? Math.round((amount / total) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);
  return { rows, total };
}

function Breakdown({ title, items }: { title: string; items: { category: string; amount: number }[] }) {
  const { rows, total } = breakdown(items);
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <span className="text-sm text-zinc-400">{formatMoney(total)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-2 text-sm text-zinc-500">Нет данных.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.category}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-zinc-300">{r.category}</span>
                <span className="text-zinc-400">
                  {formatMoney(r.amount)} <span className="text-zinc-600">· {r.pct}%</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-zinc-500" style={{ width: `${r.pct}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Stats() {
  const { year, month } = usePeriod();
  const incomesHook = useIncomes(year, month);
  const expensesHook = useExpenses(year, month);

  const income = incomesHook.incomes.reduce((s, i) => s + i.amount, 0);
  const expense = expensesHook.total;
  const profit = income - expense;
  const loading = incomesHook.loading || expensesHook.loading;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Статистика <span className="text-sm font-normal text-zinc-500">· {monthLabel(year, month)}</span>
        </h1>
        <MonthSwitcher />
      </div>

      {loading ? (
        <div className="py-10 text-center"><Spinner /></div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Доход" amount={income} />
            <StatCard label="Расход" amount={expense} />
            <StatCard label="Прибыль" amount={profit} tone={profit >= 0 ? "text-brand-green" : "text-red-400"} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Breakdown title="Доходы по категориям" items={incomesHook.incomes} />
            <Breakdown title="Расходы по категориям" items={expensesHook.expenses} />
          </div>

          <Card>
            <h2 className="mb-3 font-display text-base font-semibold">Динамика по месяцам</h2>
            <Suspense fallback={<div className="py-10 text-center"><Spinner /></div>}>
              <MonthlyChart year={year} month={month} />
            </Suspense>
          </Card>
        </div>
      )}
    </div>
  );
}
