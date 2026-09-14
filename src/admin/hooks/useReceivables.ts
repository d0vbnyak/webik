import { useCallback, useEffect, useState } from "react";
import { db } from "../lib/db";
import type { Income } from "../lib/types";

/**
 * Дебиторка: все неоплаченные и частичные доходы (без фильтра по месяцу).
 * Сортировка по ожидаемой дате оплаты (раньше — выше; null в конце).
 */
export function useReceivables() {
  const [items, setItems] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: selErr } = await db
      .from("incomes")
      .select("*")
      .in("payment_status", ["unpaid", "partial"])
      .order("due_date", { ascending: true, nullsFirst: false });
    if (selErr) setError(selErr.message);
    else setItems((data ?? []) as Income[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markPaid = useCallback(async (id: string, amount: number) => {
    const { error: updErr } = await db
      .from("incomes")
      .update({ payment_status: "paid", paid_amount: amount })
      .eq("id", id);
    if (updErr) return { error: updErr.message };
    setItems((prev) => prev.filter((i) => i.id !== id));
    return { error: null };
  }, []);

  return { items, loading, error, markPaid, reload: load };
}
