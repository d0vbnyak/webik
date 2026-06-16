import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Client, NewClient } from "../lib/types";

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: selErr } = await supabase
      .from("clients")
      .select("*")
      .order("name");
    if (selErr) setError(selErr.message);
    else setClients((data ?? []) as Client[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(async (payload: NewClient) => {
    const { data, error: insErr } = await supabase
      .from("clients")
      .insert(payload)
      .select()
      .single();
    if (insErr) return { error: insErr.message };
    setClients((prev) => [...prev, data as Client].sort((a, b) => a.name.localeCompare(b.name)));
    return { error: null };
  }, []);

  const update = useCallback(async (id: string, patch: Partial<NewClient>) => {
    const { data, error: updErr } = await supabase
      .from("clients")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (updErr) return { error: updErr.message };
    setClients((prev) =>
      prev.map((c) => (c.id === id ? (data as Client) : c)).sort((a, b) => a.name.localeCompare(b.name)),
    );
    return { error: null };
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error: delErr } = await supabase.from("clients").delete().eq("id", id);
    if (delErr) return { error: delErr.message };
    setClients((prev) => prev.filter((c) => c.id !== id));
    return { error: null };
  }, []);

  return { clients, loading, error, add, update, remove, reload: load };
}
