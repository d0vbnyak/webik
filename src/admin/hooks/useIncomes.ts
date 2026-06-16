import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Income, NewIncome } from "../lib/types";
import { monthRange } from "../lib/dates";

/** Доходы за выбранный месяц. Перезагружается при смене периода. */
export function useIncomes(year: number, month: number) {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { start, endExclusive } = monthRange(year, month);
    const { data, error: selErr } = await supabase
      .from("incomes")
      .select("*")
      .gte("date", start)
      .lt("date", endExclusive)
      .order("date", { ascending: false });
    if (selErr) setError(selErr.message);
    else setIncomes((data ?? []) as Income[]);
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(async (payload: NewIncome) => {
    const { error: insErr } = await supabase.from("incomes").insert(payload);
    if (insErr) return { error: insErr.message };
    await load();
    return { error: null };
  }, [load]);

  const update = useCallback(async (id: string, patch: Partial<NewIncome>) => {
    const { error: updErr } = await supabase.from("incomes").update(patch).eq("id", id);
    if (updErr) return { error: updErr.message };
    await load();
    return { error: null };
  }, [load]);

  const remove = useCallback(async (id: string) => {
    const { error: delErr } = await supabase.from("incomes").delete().eq("id", id);
    if (delErr) return { error: delErr.message };
    setIncomes((prev) => prev.filter((i) => i.id !== id));
    return { error: null };
  }, []);

  /** Быстрая отметка «оплачено»: статус paid, paid_amount = amount. */
  const markPaid = useCallback(async (id: string, amount: number) => {
    const { error: updErr } = await supabase
      .from("incomes")
      .update({ payment_status: "paid", paid_amount: amount })
      .eq("id", id);
    if (updErr) return { error: updErr.message };
    await load();
    return { error: null };
  }, [load]);

  return { incomes, loading, error, add, update, remove, markPaid, reload: load };
}
