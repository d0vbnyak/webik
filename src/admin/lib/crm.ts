// Правила воронки продаж: этапы, причины отказа, следующий шаг, «сегодня», отчёты.
// Источник правил — docs/03 Продажи/Воронка.md и Скрипты/12 Отказ (vault в freelance-dev).
// Чистые функции, покрыты crm.test.ts.

import type { Lead, LeadStage, LostReason, TouchType } from "./types";

/** Этапы по порядку. «Отказ» — вне порядка: на него уходят с любого шага. */
export const STAGES: { id: Exclude<LeadStage, "lost">; label: string }[] = [
  { id: "new", label: "Не писал" },
  { id: "sent", label: "Отправлено" },
  { id: "followup", label: "Вдогонку" },
  { id: "replied", label: "Ответили" },
  { id: "check", label: "Проверка" },
  { id: "call", label: "Созвон" },
  { id: "proposal", label: "КП" },
  { id: "pilot", label: "Пилот" },
  { id: "client", label: "Клиент" },
  { id: "support", label: "Сопровождение" },
];

export const ALL_STAGES: LeadStage[] = [...STAGES.map((s) => s.id), "lost"];

export function stageLabel(stage: LeadStage): string {
  if (stage === "lost") return "Отказ";
  return STAGES.find((s) => s.id === stage)?.label ?? stage;
}

/** Номер этапа в воронке; у «отказа» — -1. */
export function stageIndex(stage: LeadStage): number {
  return STAGES.findIndex((s) => s.id === stage);
}

/** Коды причин отказа — справочник из скрипта «12 Отказ и неподходящий клиент». */
export const LOST_REASONS: { id: LostReason; label: string }[] = [
  { id: "not_fit", label: "Не наш профиль" },
  { id: "private", label: "Частное лицо" },
  { id: "not_sold", label: "Снятая с продажи услуга" },
  { id: "volume", label: "Мало данных для автоматизации" },
  { id: "price", label: "Дорого" },
  { id: "timing", label: "Не сейчас" },
  { id: "decision_maker", label: "Не дошёл до ЛПР" },
  { id: "trust", label: "Нет кейсов, работаю один" },
  { id: "data", label: "Не готовы отдавать данные" },
  { id: "competitor", label: "Выбрали другого" },
  { id: "ghosted", label: "Перестал отвечать" },
  { id: "no_reply", label: "Не ответил на письма" },
];

export function lostReasonLabel(reason: LostReason | null): string {
  return LOST_REASONS.find((r) => r.id === reason)?.label ?? "без причины";
}

export const SOURCES = ["Холодное письмо", "Сайт", "Бот", "Telegram", "Рекомендация", "Другое"] as const;

/** Источник «холодный» — лид начинается с первого письма; остальные — входящие. */
export function isColdSource(source: string | null): boolean {
  return !source || source === "Холодное письмо";
}

export const VARIANTS = ["А — заявки", "Б — бот поддержки", "В — счета"] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Дата через N рабочих дней (пн–пт), как WORKDAY в компании.xlsx.
 * Праздники не учитываются — как и в таблице.
 */
export function addWorkdays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  let left = days;
  while (left > 0) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return toISO(date);
}

/**
 * Следующий шаг по умолчанию при переходе на этап. Нормативы — из скриптов:
 * вдогонку через 4 рабочих дня, максимум 3 касания, на ответ — в тот же день.
 * UI подставляет это в форму, Сергей может поправить.
 */
export function defaultNextStep(stage: LeadStage, todayIso: string): { text: string; date: string } {
  switch (stage) {
    case "new":
      return { text: "Отправить первое письмо", date: todayIso };
    case "sent":
      return { text: "Письмо вдогонку", date: addWorkdays(todayIso, 4) };
    case "followup":
      return { text: "Нет ответа — закрыть отказом «не ответил»", date: addWorkdays(todayIso, 5) };
    case "replied":
      return { text: "Ответить и квалифицировать", date: todayIso };
    case "check":
      return { text: "Сделать бесплатную проверку и отправить результат", date: addWorkdays(todayIso, 2) };
    case "call":
      return { text: "Провести созвон по брифу", date: addWorkdays(todayIso, 1) };
    case "proposal":
      return { text: "Узнать решение по КП", date: addWorkdays(todayIso, 3) };
    case "pilot":
      return { text: "Сдать пилот", date: addWorkdays(todayIso, 10) };
    case "client":
      return { text: "Предложить сопровождение", date: addWorkdays(todayIso, 5) };
    case "support":
      return { text: "Ежемесячный отчёт клиенту", date: addWorkdays(todayIso, 20) };
    case "lost":
      return { text: "", date: "" };
  }
}

/**
 * Самый дальний достигнутый этап. Возврат назад и отказ его не уменьшают —
 * по нему считаются конверсии.
 */
export function nextReachedStage(
  reached: Exclude<LeadStage, "lost">,
  to: LeadStage,
): Exclude<LeadStage, "lost"> {
  if (to === "lost") return reached;
  return stageIndex(to) > stageIndex(reached) ? to : reached;
}

/** Шаг и дата задаются парой: шаг без даты не всплывёт в «Сегодня», дата без шага — пустое дело. */
export function nextStepError(text: string, date: string): string | null {
  if (text.trim() && !date) return "Укажите дату следующего шага";
  if (!text.trim() && date) return "Напишите, что сделать, или очистите дату";
  return null;
}

export type StageChange = {
  stage: LeadStage;
  reached_stage: Exclude<LeadStage, "lost">;
  lost_reason: LostReason | null;
  next_step: string | null;
  next_step_date: string | null;
};

/** Проверка и сборка патча смены этапа. Отказ без причины не принимается. */
export function buildStageChange(
  lead: Pick<Lead, "reached_stage">,
  to: LeadStage,
  opts: { lostReason?: LostReason | null; nextStep?: string; nextStepDate?: string },
): { patch: StageChange; error: null } | { patch: null; error: string } {
  if (to === "lost" && !opts.lostReason) {
    return { patch: null, error: "Укажите причину отказа" };
  }
  const nextStep = opts.nextStep?.trim() || null;
  const nextStepDate = opts.nextStepDate || null;
  const stepError = nextStepError(nextStep ?? "", nextStepDate ?? "");
  if (stepError) return { patch: null, error: stepError };
  return {
    patch: {
      stage: to,
      reached_stage: nextReachedStage(lead.reached_stage, to),
      lost_reason: to === "lost" ? (opts.lostReason ?? null) : null,
      next_step: nextStep,
      next_step_date: nextStepDate,
    },
    error: null,
  };
}

export const TOUCH_TYPES: { id: TouchType; label: string }[] = [
  { id: "email", label: "Письмо" },
  { id: "followup", label: "Письмо вдогонку" },
  { id: "call", label: "Звонок" },
  { id: "message", label: "Сообщение" },
  { id: "meeting", label: "Созвон" },
  { id: "proposal", label: "КП отправлено" },
  { id: "note", label: "Заметка" },
];

export function touchLabel(type: TouchType): string {
  if (type === "stage") return "Этап";
  return TOUCH_TYPES.find((t) => t.id === type)?.label ?? type;
}

/**
 * Этап, на который касание переводит лида, или null — остаётся где был.
 * Только вперёд и только очевидные случаи: письмо первому → «Отправлено»,
 * вдогонку → «Вдогонку», созвон → «Созвон», КП → «КП». Из отказа не выводит.
 */
export function stageAfterTouch(stage: LeadStage, type: TouchType): LeadStage | null {
  const target: Partial<Record<TouchType, LeadStage>> = {
    email: "sent",
    followup: "followup",
    meeting: "call",
    proposal: "proposal",
  };
  const to = target[type];
  if (!to || stage === "lost") return null;
  if (type === "email" && stage !== "new") return null; // повторное письмо — не новый этап
  return stageIndex(to) > stageIndex(stage) ? to : null;
}

/** Лиды, по которым сегодня есть дело: дата шага наступила. Просроченные — первыми. */
export function dueToday<T extends Pick<Lead, "next_step_date" | "priority" | "company">>(
  leads: T[],
  todayIso: string,
): T[] {
  return leads
    .filter((l) => l.next_step_date && l.next_step_date <= todayIso)
    .sort(
      (a, b) =>
        (a.next_step_date ?? "").localeCompare(b.next_step_date ?? "") ||
        (a.priority ?? 9) - (b.priority ?? 9) ||
        a.company.localeCompare(b.company),
    );
}

export type FunnelRow = {
  stage: Exclude<LeadStage, "lost">;
  label: string;
  reached: number;
  /** Доля от предыдущего этапа, 0–100; null — делить не на что. */
  fromPrev: number | null;
};

/**
 * Конверсии по этапам. Лид «дошёл» до этапа, если его reached_stage не раньше.
 * Воронка начинается с «Отправлено»: «не писал» — ещё не контакт. «Вдогонку»
 * не показывается: по reached_stage в неё попадают и ответившие на первое
 * письмо, и входящие, число вводило бы в заблуждение.
 */
export function funnel(leads: Pick<Lead, "reached_stage">[]): FunnelRow[] {
  const rows: FunnelRow[] = [];
  let prev: number | null = null;
  for (const s of STAGES) {
    if (s.id === "new" || s.id === "followup") continue;
    const idx = stageIndex(s.id);
    const reached = leads.filter((l) => stageIndex(l.reached_stage) >= idx).length;
    rows.push({
      stage: s.id,
      label: s.label,
      reached,
      fromPrev: prev === null || prev === 0 ? null : Math.round((reached / prev) * 100),
    });
    prev = reached;
  }
  return rows;
}

export type ReasonRow = { reason: LostReason | null; label: string; count: number; share: number };

/**
 * Причины отказов, частые — выше. Сигнал по правилу из скрипта: больше трети
 * отказов из-за одной причины — менять упаковку, цену или сегмент. Меньше трёх
 * отказов — выборка слишком мала, сигнала нет.
 */
export function lostReasons(leads: Pick<Lead, "stage" | "lost_reason">[]): {
  rows: ReasonRow[];
  total: number;
  signal: ReasonRow | null;
} {
  const lost = leads.filter((l) => l.stage === "lost");
  const counts = new Map<LostReason | null, number>();
  for (const l of lost) counts.set(l.lost_reason, (counts.get(l.lost_reason) ?? 0) + 1);
  const total = lost.length;
  const rows = [...counts.entries()]
    .map(([reason, count]) => ({
      reason,
      label: lostReasonLabel(reason),
      count,
      share: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  // «Без причины» — не сигнал: это пробел в записях, а не причина
  const top = rows.find((r) => r.reason !== null);
  const signal = total >= 3 && top && top.count * 3 > total ? top : null;
  return { rows, total, signal };
}

/** «1 дело», «3 дела», «5 дел». */
export function pluralDeals(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} дело`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} дела`;
  return `${n} дел`;
}

/** Месяц (YYYY-MM) метки времени в локальном поясе, а не в UTC. */
export function localMonth(timestamp: string): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
