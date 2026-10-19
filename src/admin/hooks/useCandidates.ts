import { useCallback, useEffect, useState } from "react";
import { db } from "../lib/db";
import { freshCandidates } from "../lib/candidates";
import type { Candidate, NewCandidate } from "../lib/types";
import type { WriteResult } from "./useLeads";

type CandidatePatch = Partial<Omit<Candidate, "id" | "user_id" | "created_at">>;

/** Кандидаты на редизайн. Их десятки-сотни — грузим целиком, сортирует экран. */
export function useCandidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: selErr } = await db.from("candidates").select("*").order("created_at");
    if (selErr) setError(selErr.message);
    else setCandidates((data ?? []) as Candidate[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(async (id: string, patch: CandidatePatch): Promise<WriteResult> => {
    const { data, error: updErr } = await db.from("candidates").update(patch).eq("id", id).select().single();
    if (updErr) return { error: updErr.message };
    setCandidates((prev) => prev.map((c) => (c.id === id ? (data as Candidate) : c)));
    return { error: null };
  }, []);

  const remove = useCallback(async (id: string): Promise<WriteResult> => {
    const { error: delErr } = await db.from("candidates").delete().eq("id", id);
    if (delErr) return { error: delErr.message };
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    return { error: null };
  }, []);

  /**
   * Импорт: домены, которые уже есть в базе, пропускаются. Вставка с
   * ignoreDuplicates — на случай, если кандидата добавили в другой вкладке.
   */
  const importMany = useCallback(
    async (items: NewCandidate[]): Promise<{ added: number; skipped: string[]; error: string | null }> => {
      const { data: existing, error: selErr } = await db.from("candidates").select("domain");
      if (selErr) return { added: 0, skipped: [], error: selErr.message };
      const { fresh, skipped } = freshCandidates(items, (existing ?? []) as Pick<Candidate, "domain">[]);
      if (fresh.length === 0) return { added: 0, skipped: skipped.map((s) => s.domain), error: null };
      const { data, error: insErr } = await db
        .from("candidates")
        .upsert(fresh, { onConflict: "user_id,domain", ignoreDuplicates: true })
        .select();
      if (insErr) return { added: 0, skipped: skipped.map((s) => s.domain), error: insErr.message };
      const added = (data ?? []) as Candidate[];
      setCandidates((prev) => [...prev, ...added]);
      return { added: added.length, skipped: skipped.map((s) => s.domain), error: null };
    },
    [],
  );

  return { candidates, loading, error, update, remove, importMany, reload: load };
}
