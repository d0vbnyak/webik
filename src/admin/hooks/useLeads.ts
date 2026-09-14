import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { leadKey, type ImportedLead } from "../lib/leadImport";
import type { StageChange } from "../lib/crm";
import { todayISO } from "../lib/dates";
import type { Lead, LeadTouch, NewLead, TouchType } from "../lib/types";

type LeadPatch = Partial<Omit<Lead, "id" | "user_id" | "created_at">>;

/** Все лиды воронки. Сортировка: ближайший шаг выше, без шага — в конце. */
export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: selErr } = await supabase
      .from("leads")
      .select("*")
      .order("next_step_date", { ascending: true, nullsFirst: false })
      .order("company");
    if (selErr) setError(selErr.message);
    else setLeads((data ?? []) as Lead[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(async (payload: NewLead): Promise<{ id: string | null; error: string | null }> => {
    const { data, error: insErr } = await supabase.from("leads").insert(payload).select().single();
    if (insErr) return { id: null, error: insErr.message };
    setLeads((prev) => [...prev, data as Lead]);
    return { id: (data as Lead).id, error: null };
  }, []);

  /**
   * Импорт: дубли (тот же сайт или название) пропускаются, касания из таблицы
   * пишутся следом. Возвращает, сколько добавлено и сколько было уже в базе.
   */
  const importMany = useCallback(
    async (items: ImportedLead[]): Promise<{ added: number; skipped: number; error: string | null }> => {
      const { data: existing, error: selErr } = await supabase.from("leads").select("company, website");
      if (selErr) return { added: 0, skipped: 0, error: selErr.message };

      const seen = new Set((existing ?? []).map((l) => leadKey(l as Pick<Lead, "company" | "website">)));
      const fresh: ImportedLead[] = [];
      for (const item of items) {
        const key = leadKey(item.lead);
        if (seen.has(key)) continue;
        seen.add(key); // и дубли внутри самой вставки
        fresh.push(item);
      }
      const skipped = items.length - fresh.length;
      if (fresh.length === 0) return { added: 0, skipped, error: null };

      const { data: inserted, error: insErr } = await supabase
        .from("leads")
        .insert(fresh.map((i) => i.lead))
        .select("id, company, website");
      if (insErr) return { added: 0, skipped, error: insErr.message };

      // Касания привязываем по ключу, а не по порядку ответа
      const idByKey = new Map((inserted ?? []).map((l) => [leadKey(l as Pick<Lead, "company" | "website">), l.id as string]));
      const touches = fresh.flatMap((item) => {
        const leadId = idByKey.get(leadKey(item.lead));
        return leadId ? item.touches.map((t) => ({ ...t, lead_id: leadId })) : [];
      });
      if (touches.length > 0) {
        const { error: tErr } = await supabase.from("lead_touches").insert(touches);
        if (tErr) {
          await load();
          return { added: fresh.length, skipped, error: `Лиды добавлены, но история касаний не записалась: ${tErr.message}` };
        }
      }
      await load();
      return { added: fresh.length, skipped, error: null };
    },
    [load],
  );

  return { leads, loading, error, add, importMany, reload: load };
}

/** Одна карточка лида: сам лид, история касаний, доходы привязанного клиента. */
export function useLead(id: string | undefined) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [touches, setTouches] = useState<LeadTouch[]>([]);
  const [clientIncome, setClientIncome] = useState<{ amount: number; paid: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadIncome = useCallback(async (clientId: string | null) => {
    if (!clientId) return setClientIncome(null);
    const { data } = await supabase.from("incomes").select("amount, paid_amount").eq("client_id", clientId);
    const rows = (data ?? []) as { amount: number; paid_amount: number }[];
    setClientIncome({
      amount: rows.reduce((s, r) => s + Number(r.amount), 0),
      paid: rows.reduce((s, r) => s + Number(r.paid_amount), 0),
    });
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const [leadRes, touchRes] = await Promise.all([
      supabase.from("leads").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("lead_touches")
        .select("*")
        .eq("lead_id", id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    if (leadRes.error || touchRes.error) {
      setError((leadRes.error ?? touchRes.error)!.message);
    } else {
      const l = leadRes.data as Lead | null;
      setLead(l);
      setTouches((touchRes.data ?? []) as LeadTouch[]);
      await loadIncome(l?.client_id ?? null);
    }
    setLoading(false);
  }, [id, loadIncome]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (patch: LeadPatch) => {
      if (!id) return { error: "Нет лида" };
      const { data, error: updErr } = await supabase.from("leads").update(patch).eq("id", id).select().single();
      if (updErr) return { error: updErr.message };
      setLead(data as Lead);
      return { error: null };
    },
    [id],
  );

  const addTouch = useCallback(
    async (touch: { type: TouchType; date: string; comment: string | null }) => {
      if (!id) return { error: "Нет лида" };
      const { data, error: insErr } = await supabase
        .from("lead_touches")
        .insert({ ...touch, lead_id: id })
        .select()
        .single();
      if (insErr) return { error: insErr.message };
      setTouches((prev) =>
        [data as LeadTouch, ...prev].sort(
          (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
        ),
      );
      return { error: null };
    },
    [id],
  );

  /** Смена этапа: патч лида + запись в историю. Патч собирается в crm.buildStageChange. */
  const changeStage = useCallback(
    async (patch: StageChange, historyComment: string) => {
      const res = await update({ ...patch, stage_changed_at: new Date().toISOString() });
      if (res.error) return res;
      return addTouch({ type: "stage", date: todayISO(), comment: historyComment });
    },
    [update, addTouch],
  );

  const removeTouch = useCallback(async (touchId: string) => {
    const { error: delErr } = await supabase.from("lead_touches").delete().eq("id", touchId);
    if (delErr) return { error: delErr.message };
    setTouches((prev) => prev.filter((t) => t.id !== touchId));
    return { error: null };
  }, []);

  const remove = useCallback(async () => {
    if (!id) return { error: "Нет лида" };
    const { error: delErr } = await supabase.from("leads").delete().eq("id", id);
    return { error: delErr?.message ?? null };
  }, [id]);

  /** Лид → клиент: создаёт запись в «Клиентах» и привязывает к лиду. Доходы вешаются на клиента. */
  const makeClient = useCallback(async () => {
    if (!lead) return { error: "Нет лида" };
    if (lead.client_id) return { error: null };
    const { data, error: insErr } = await supabase
      .from("clients")
      .insert({
        name: lead.company,
        phone: lead.phone,
        telegram_username: lead.telegram_username,
        max_link: null,
      })
      .select("id")
      .single();
    if (insErr) return { error: insErr.message };
    const res = await update({ client_id: (data as { id: string }).id });
    if (!res.error) await loadIncome((data as { id: string }).id);
    return res;
  }, [lead, update, loadIncome]);

  return { lead, touches, clientIncome, loading, error, update, addTouch, removeTouch, changeStage, remove, makeClient, reload: load };
}
