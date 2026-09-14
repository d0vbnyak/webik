import { useCallback, useEffect, useState } from "react";
import { db } from "../lib/db";
import type { Goal } from "../lib/types";

/** Цели по доходу. Загружаем все, выбор/сохранение по паре (year, month). */
export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: selErr } = await db.from("goals").select("*");
    if (selErr) setError(selErr.message);
    else setGoals((data ?? []) as Goal[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const getGoal = useCallback(
    (year: number, month: number): Goal | undefined =>
      goals.find((g) => g.year === year && g.month === month),
    [goals],
  );

  /** Создать/обновить цель месяца (upsert по уникальной паре user_id+year+month). */
  const setGoal = useCallback(async (year: number, month: number, target_amount: number) => {
    const { data, error: upErr } = await db
      .from("goals")
      .upsert({ year, month, target_amount }, { onConflict: "user_id,year,month" })
      .select()
      .single();
    if (upErr) return { error: upErr.message };
    setGoals((prev) => {
      const next = prev.filter((g) => !(g.year === year && g.month === month));
      return [...next, data as Goal];
    });
    return { error: null };
  }, []);

  return { goals, loading, error, getGoal, setGoal, reload: load };
}
