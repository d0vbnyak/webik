import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { RecurringExpense, NewRecurringExpense } from "../lib/types";

export function useRecurring() {
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: selErr } = await supabase
      .from("recurring_expenses")
      .select("*")
      .order("next_charge_date", { ascending: true });
    if (selErr) setError(selErr.message);
    else setRecurring((data ?? []) as RecurringExpense[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(async (payload: NewRecurringExpense) => {
    const { error: insErr } = await supabase.from("recurring_expenses").insert(payload);
    if (insErr) return { error: insErr.message };
    await load();
    return { error: null };
  }, [load]);

  const update = useCallback(async (id: string, patch: Partial<NewRecurringExpense>) => {
    const { data, error: updErr } = await supabase
      .from("recurring_expenses")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (updErr) return { error: updErr.message };
    setRecurring((prev) => prev.map((r) => (r.id === id ? (data as RecurringExpense) : r)));
    return { error: null };
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error: delErr } = await supabase.from("recurring_expenses").delete().eq("id", id);
    if (delErr) return { error: delErr.message };
    setRecurring((prev) => prev.filter((r) => r.id !== id));
    return { error: null };
  }, []);

  return { recurring, loading, error, add, update, remove, reload: load };
}
