import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Category, CategoryType } from "../lib/types";

const DEFAULTS: { type: CategoryType; name: string }[] = [
  { type: "expense", name: "Реклама" },
  { type: "expense", name: "ИИ" },
  { type: "expense", name: "Сервисы и подписки" },
  { type: "expense", name: "Прочее" },
  { type: "income", name: "Веб" },
  { type: "income", name: "Боты" },
  { type: "income", name: "SEO" },
];

/**
 * Категории расходов/доходов. При первом входе (категорий нет) сеются дефолты
 * идемпотентно (upsert с ignoreDuplicates по (user_id,type,name)).
 */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (): Promise<Category[] | null> => {
    const { data, error: selErr } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    if (selErr) {
      setError(selErr.message);
      return null;
    }
    return (data ?? []) as Category[];
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let rows = await fetchAll();
    if (rows && rows.length === 0) {
      const { error: upErr } = await supabase
        .from("categories")
        .upsert(DEFAULTS, { onConflict: "user_id,type,name", ignoreDuplicates: true });
      if (upErr) setError(upErr.message);
      else rows = await fetchAll();
    }
    if (rows) setCategories(rows);
    setLoading(false);
  }, [fetchAll]);

  useEffect(() => {
    void load();
  }, [load]);

  const byType = useCallback(
    (type: CategoryType) => categories.filter((c) => c.type === type),
    [categories],
  );

  const addCategory = useCallback(async (type: CategoryType, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { error: "Введите название категории" };
    const { error: insErr } = await supabase
      .from("categories")
      .upsert({ type, name: trimmed }, { onConflict: "user_id,type,name", ignoreDuplicates: true });
    if (insErr) return { error: insErr.message };
    const rows = await fetchAll();
    if (rows) setCategories(rows);
    return { error: null };
  }, [fetchAll]);

  const removeCategory = useCallback(async (id: string) => {
    const { error: delErr } = await supabase.from("categories").delete().eq("id", id);
    if (delErr) return { error: delErr.message };
    setCategories((prev) => prev.filter((c) => c.id !== id));
    return { error: null };
  }, []);

  return { categories, byType, loading, error, addCategory, removeCategory, reload: load };
}
