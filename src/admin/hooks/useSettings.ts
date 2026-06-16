import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Settings } from "../lib/types";

/**
 * Настройки пользователя (одна строка). При первом входе строка создаётся
 * идемпотентно (upsert с ignoreDuplicates — без гонок и дублей).
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: selErr } = await supabase
      .from("settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (selErr) {
      setError(selErr.message);
      setLoading(false);
      return;
    }
    if (data) {
      setSettings(data as Settings);
      setLoading(false);
      return;
    }
    // Строки нет — создаём дефолтную (tax_rate = 6)
    const { error: upErr } = await supabase
      .from("settings")
      .upsert({ tax_rate: 6, default_monthly_goal: null }, { onConflict: "user_id", ignoreDuplicates: true });
    if (upErr) {
      setError(upErr.message);
      setLoading(false);
      return;
    }
    const { data: created, error: reErr } = await supabase
      .from("settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (reErr) setError(reErr.message);
    else setSettings((created as Settings) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (patch: Partial<Pick<Settings, "tax_rate" | "default_monthly_goal">>) => {
      if (!settings) return { error: "Настройки ещё не загружены" };
      const { data, error: updErr } = await supabase
        .from("settings")
        .update(patch)
        .eq("id", settings.id)
        .select()
        .single();
      if (updErr) return { error: updErr.message };
      setSettings(data as Settings);
      return { error: null };
    },
    [settings],
  );

  return { settings, loading, error, update, reload: load };
}
