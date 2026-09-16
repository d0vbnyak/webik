import { useCallback, useEffect, useState } from "react";
import { db } from "../lib/db";
import type { Income } from "../lib/types";
import { monthRange } from "../lib/dates";

/**
 * Σ полученного (paid_amount) по всем доходам ДО начала выбранного месяца.
 *
 * Нужно для налогового вычета: он даётся один раз на всё время работы, поэтому
 * остаток на начало месяца зависит от всей предыдущей истории, а не от периода
 * на экране.
 *
 * Как и остальной учёт, считает по полю `date` (дата работы), а не по дате
 * фактического поступления денег — отдельного поля для неё в базе нет.
 */
export function useReceivedBefore(year: number, month: number) {
  const [received, setReceived] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { start } = monthRange(year, month);
    const { data, error: selErr } = await db
      .from("incomes")
      .select("paid_amount")
      .lt("date", start);
    if (selErr) {
      setError(selErr.message);
      setReceived(0);
    } else {
      const rows = (data ?? []) as Pick<Income, "paid_amount">[];
      setReceived(rows.reduce((s, r) => s + (r.paid_amount ?? 0), 0));
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  return { received, loading, error, reload: load };
}
