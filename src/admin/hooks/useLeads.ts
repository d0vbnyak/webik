import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../lib/db";
import { dropDuplicates, FIRST_EMAIL_STEP, scheduleFirstEmails, type ImportedLead } from "../lib/leadImport";
import type { StageChange } from "../lib/crm";
import { todayISO } from "../lib/dates";
import type { Lead, LeadTouch, NewLead, TouchType } from "../lib/types";

type LeadPatch = Partial<Omit<Lead, "id" | "user_id" | "created_at">>;

/**
 * Все лиды воронки. Сортировка: ближайший шаг выше, без шага — в конце.
 * Выгружаются целиком: для одного человека с холодным аутричем это сотни строк;
 * если счёт пойдёт на десятки тысяч — нужна постраничная выгрузка.
 */
export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: selErr } = await db
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
    const { data, error: insErr } = await db.from("leads").insert(payload).select().single();
    if (insErr) return { id: null, error: insErr.message };
    setLeads((prev) => [...prev, data as Lead]);
    return { id: (data as Lead).id, error: null };
  }, []);

  /**
   * Импорт: дубли с базой (по сайту или названию) пропускаются, первые письма
   * планируются уже после этого — с учётом писем, стоящих в базе на те же дни.
   * Касания из таблицы пишутся следом.
   */
  const importMany = useCallback(
    async (items: ImportedLead[]): Promise<{ added: number; skippedNames: string[]; error: string | null }> => {
      const { data: existing, error: selErr } = await db
        .from("leads")
        .select("company, website, next_step, next_step_date");
      if (selErr) return { added: 0, skippedNames: [], error: selErr.message };
      const rows = (existing ?? []) as Pick<Lead, "company" | "website" | "next_step" | "next_step_date">[];

      const today = todayISO();
      const { fresh, skippedNames } = dropDuplicates(items, rows);
      if (fresh.length === 0) return { added: 0, skippedNames, error: null };

      const booked: Record<string, number> = {};
      for (const r of rows) {
        if (r.next_step === FIRST_EMAIL_STEP && r.next_step_date && r.next_step_date >= today) {
          booked[r.next_step_date] = (booked[r.next_step_date] ?? 0) + 1;
        }
      }
      // Копия: превью в модалке не должно меняться, если импорт упадёт
      const planned = scheduleFirstEmails(
        fresh.map((i) => ({ ...i, lead: { ...i.lead } })),
        today,
        booked,
      );

      // id генерируем сами: касания привязываются к нему, а не к порядку ответа базы
      const withIds = planned.map((i) => ({ ...i, id: crypto.randomUUID() }));
      const { error: insErr } = await db
        .from("leads")
        .insert(withIds.map((i) => ({ ...i.lead, id: i.id, stage_changed_at: `${i.stageChangedOn}T12:00:00` })));
      if (insErr) return { added: 0, skippedNames, error: insErr.message };

      const touches = withIds.flatMap((item) => item.touches.map((t) => ({ ...t, lead_id: item.id })));
      let touchError: string | null = null;
      if (touches.length > 0) {
        const { error: tErr } = await db.from("lead_touches").insert(touches);
        if (tErr) touchError = `Лиды добавлены, но история касаний из таблицы не записалась: ${tErr.message}`;
      }
      await load();
      return { added: planned.length, skippedNames, error: touchError };
    },
    [load],
  );

  return { leads, loading, error, add, importMany, reload: load };
}

/** Ответ хука на запись: error — ничего не записано, partial — записана только часть. */
export type WriteResult = { error: string | null; partial?: boolean };

/** Одна карточка лида: сам лид, история касаний, доходы привязанного клиента. */
export function useLead(id: string | undefined) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [touches, setTouches] = useState<LeadTouch[]>([]);
  const [clientIncome, setClientIncome] = useState<{ amount: number; paid: number } | null>(null);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ответ для прошлого id не должен перезаписать открытую карточку
  const currentId = useRef(id);
  currentId.current = id;

  const loadIncome = useCallback(async (clientId: string | null) => {
    setIncomeError(null);
    if (!clientId) return setClientIncome(null);
    const { data, error: selErr } = await db.from("incomes").select("amount, paid_amount").eq("client_id", clientId);
    if (selErr) {
      setClientIncome(null);
      return setIncomeError(selErr.message);
    }
    const rows = (data ?? []) as { amount: number; paid_amount: number }[];
    setClientIncome({
      amount: rows.reduce((s, r) => s + Number(r.amount), 0),
      paid: rows.reduce((s, r) => s + Number(r.paid_amount), 0),
    });
  }, []);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [leadRes, touchRes] = await Promise.all([
      db.from("leads").select("*").eq("id", id).maybeSingle(),
      db
        .from("lead_touches")
        .select("*")
        .eq("lead_id", id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    if (currentId.current !== id) return;
    if (leadRes.error || touchRes.error) {
      setError((leadRes.error ?? touchRes.error)!.message);
    } else {
      const l = leadRes.data as Lead | null;
      setLead(l);
      setTouches((touchRes.data ?? []) as LeadTouch[]);
      await loadIncome(l?.client_id ?? null);
    }
    if (currentId.current === id) setLoading(false);
  }, [id, loadIncome]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (patch: LeadPatch): Promise<WriteResult> => {
      if (!id) return { error: "Нет лида" };
      const { data, error: updErr } = await db.from("leads").update(patch).eq("id", id).select().single();
      if (updErr) return { error: updErr.message };
      setLead(data as Lead);
      return { error: null };
    },
    [id],
  );

  const addTouch = useCallback(
    async (touch: { type: TouchType; date: string; comment: string | null }): Promise<WriteResult> => {
      if (!id) return { error: "Нет лида" };
      const { data, error: insErr } = await db
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

  /**
   * Смена этапа: патч лида + запись в историю. Патч собирается в crm.buildStageChange.
   * Если этап сменился, а история не записалась — partial: повторять смену нельзя,
   * иначе в истории появится «Отправлено → Отправлено».
   */
  const changeStage = useCallback(
    async (patch: StageChange, historyComment: string): Promise<WriteResult> => {
      const res = await update({ ...patch, stage_changed_at: new Date().toISOString() });
      if (res.error) return res;
      const hist = await addTouch({ type: "stage", date: todayISO(), comment: historyComment });
      if (hist.error) return { error: `Этап сменён, но запись в историю не сохранилась: ${hist.error}`, partial: true };
      return { error: null };
    },
    [update, addTouch],
  );

  const removeTouch = useCallback(async (touchId: string): Promise<WriteResult> => {
    const { error: delErr } = await db.from("lead_touches").delete().eq("id", touchId);
    if (delErr) return { error: delErr.message };
    setTouches((prev) => prev.filter((t) => t.id !== touchId));
    return { error: null };
  }, []);

  const remove = useCallback(async (): Promise<WriteResult> => {
    if (!id) return { error: "Нет лида" };
    const { error: delErr } = await db.from("leads").delete().eq("id", id);
    return { error: delErr?.message ?? null };
  }, [id]);

  /**
   * Лид → клиент: создаёт запись в «Клиентах» и привязывает к лиду. Доходы вешаются
   * на клиента. Если привязать не вышло — созданный клиент удаляется, чтобы
   * повторное нажатие не плодило сирот.
   */
  const makeClient = useCallback(async (): Promise<WriteResult> => {
    if (!lead) return { error: "Нет лида" };
    if (lead.client_id) return { error: null };
    const { data, error: insErr } = await db
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
    const clientId = (data as { id: string }).id;
    const res = await update({ client_id: clientId });
    if (res.error) {
      await db.from("clients").delete().eq("id", clientId);
      return res;
    }
    await loadIncome(clientId);
    return res;
  }, [lead, update, loadIncome]);

  return {
    lead,
    touches,
    clientIncome,
    incomeError,
    loading,
    error,
    update,
    addTouch,
    removeTouch,
    changeStage,
    remove,
    makeClient,
    reload: load,
  };
}
