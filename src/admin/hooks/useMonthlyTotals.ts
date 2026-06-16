import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { monthRange, monthShort } from "../lib/dates";

export interface MonthlyPoint {
  label: string;
  income: number;
  expense: number;
  profit: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

function lastMonths(endYear: number, endMonth: number, count: number) {
  const arr: { year: number; month: number }[] = [];
  let y = endYear;
  let m = endMonth;
  for (let k = 0; k < count; k++) {
    arr.unshift({ year: y, month: m });
    if (m === 1) {
      m = 12;
      y--;
    } else {
      m--;
    }
  }
  return arr;
}

/** Помесячные итоги (доход/расход/прибыль) за `count` месяцев, заканчивая выбранным. */
export function useMonthlyTotals(endYear: number, endMonth: number, count = 12) {
  const [data, setData] = useState<MonthlyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const months = lastMonths(endYear, endMonth, count);
      const start = `${months[0].year}-${pad(months[0].month)}-01`;
      const endExclusive = monthRange(endYear, endMonth).endExclusive;

      const [incRes, expRes] = await Promise.all([
        supabase.from("incomes").select("date,amount").gte("date", start).lt("date", endExclusive),
        supabase.from("expenses").select("date,amount").gte("date", start).lt("date", endExclusive),
      ]);
      if (cancelled) return;
      if (incRes.error || expRes.error) {
        setError(incRes.error?.message ?? expRes.error?.message ?? "Ошибка загрузки");
        setLoading(false);
        return;
      }

      const incomeByKey = new Map<string, number>();
      const expenseByKey = new Map<string, number>();
      for (const r of (incRes.data ?? []) as { date: string; amount: number }[]) {
        const key = r.date.slice(0, 7);
        incomeByKey.set(key, (incomeByKey.get(key) ?? 0) + r.amount);
      }
      for (const r of (expRes.data ?? []) as { date: string; amount: number }[]) {
        const key = r.date.slice(0, 7);
        expenseByKey.set(key, (expenseByKey.get(key) ?? 0) + r.amount);
      }

      const points: MonthlyPoint[] = months.map(({ year, month }) => {
        const key = `${year}-${pad(month)}`;
        const income = incomeByKey.get(key) ?? 0;
        const expense = expenseByKey.get(key) ?? 0;
        return { label: monthShort(month), income, expense, profit: income - expense };
      });

      setData(points);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [endYear, endMonth, count]);

  return { data, loading, error };
}
