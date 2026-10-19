// Правила проектов редизайна: этапы плагина webik, шаг по умолчанию, «сегодня».
// Чистые функции, покрыты projects.test.ts.

import { PROJECT_STAGES, SLUG_RE, projectStageIndex } from "../../../shared/projects";
import { addWorkdays } from "./crm";
import type { Project, ProjectEventType, ProjectStage } from "./types";

export { PROJECT_STAGES, projectStageIndex, projectStageLabel } from "../../../shared/projects";

/**
 * Что обычно делаем после перехода на этап. Подставляется в форму смены этапа,
 * поправить можно. На «Демо» мяч у клиента — шаг про то, чтобы узнать решение.
 */
export function defaultProjectStep(stage: ProjectStage, todayIso: string): { text: string; date: string } {
  switch (stage) {
    case "audited":
      return { text: "Отправить клиенту бриф и вопросы из аудита", date: todayIso };
    case "designing":
      return { text: "Показать макет и собрать правки", date: addWorkdays(todayIso, 3) };
    case "built":
      return { text: "Проверить сборку и выложить на демо", date: addWorkdays(todayIso, 1) };
    case "demo":
      return { text: "Узнать решение по демо", date: addWorkdays(todayIso, 3) };
    case "prod":
      return { text: "Проверить формы, Вебмастер и 301 после выкладки", date: addWorkdays(todayIso, 2) };
  }
}

/** Проекты в работе: не закрытые и не на проде. */
export function isActive(p: Pick<Project, "closed" | "stage">): boolean {
  return !p.closed && p.stage !== "prod";
}

/** Дела на сегодня: шаг с наступившей датой у незакрытых проектов, просроченные первыми. */
export function projectsDue<T extends Pick<Project, "next_step_date" | "closed" | "name">>(list: T[], todayIso: string): T[] {
  return list
    .filter((p) => !p.closed && p.next_step_date && p.next_step_date <= todayIso)
    .sort((a, b) => (a.next_step_date ?? "").localeCompare(b.next_step_date ?? "") || a.name.localeCompare(b.name));
}

/** Демо у клиента — ждём решения. Дольше всех ждущие — первыми. */
export function waitingOnClient<T extends Pick<Project, "stage" | "closed" | "stage_changed_at">>(list: T[]): T[] {
  return list
    .filter((p) => !p.closed && p.stage === "demo")
    .sort((a, b) => a.stage_changed_at.localeCompare(b.stage_changed_at));
}

/** Сколько полных дней прошло с метки времени до сегодняшней даты (локально). */
export function daysSince(timestamp: string, todayIso: string): number {
  const d = new Date(timestamp);
  const from = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const [y, m, day] = todayIso.split("-").map(Number);
  return Math.max(0, Math.round((Date.UTC(y, m - 1, day) - from) / 86_400_000));
}

/** «stroymir.ru» из «https://www.stroymir.ru/old/». Не ссылка — как есть. */
export function domainOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Ссылка из ввода: «site.ru» → «https://site.ru/». Пусто — null, мусор — ошибка. */
export function normalizeUrl(input: string): { url: string | null; error: string | null } {
  const v = input.trim();
  if (!v) return { url: null, error: null };
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!u.hostname.includes(".")) return { url: null, error: `Не похоже на адрес сайта: ${v}` };
    return { url: u.toString(), error: null };
  } catch {
    return { url: null, error: `Не похоже на адрес сайта: ${v}` };
  }
}

/** slug по домену, как в плагине: «stroymir.ru» → «stroymir». */
export function slugFromUrl(url: string | null): string {
  const host = domainOf(url) ?? "";
  const first = host.split(".")[0] ?? "";
  return first
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function slugError(slug: string): string | null {
  return SLUG_RE.test(slug) ? null : "slug: латиница, цифры и дефис, начинается с буквы или цифры";
}

/** Пройденные этапы — для шкалы: до текущего включительно. */
export function stageReached(current: ProjectStage, stage: ProjectStage): "done" | "current" | "ahead" {
  const a = projectStageIndex(current);
  const b = projectStageIndex(stage);
  return b < a ? "done" : b === a ? "current" : "ahead";
}

export const PROJECT_EVENT_TYPES: { id: Exclude<ProjectEventType, "stage" | "sync">; label: string }[] = [
  { id: "call", label: "Звонок" },
  { id: "message", label: "Сообщение" },
  { id: "meeting", label: "Созвон" },
  { id: "note", label: "Заметка" },
];

export function eventLabel(type: ProjectEventType): string {
  if (type === "stage") return "Этап";
  if (type === "sync") return "Плагин";
  return PROJECT_EVENT_TYPES.find((t) => t.id === type)?.label ?? type;
}

/** Счётчик по этапам для фильтра и доски. */
export function countByStage(list: Pick<Project, "stage" | "closed">[]): Record<ProjectStage, number> {
  const out = Object.fromEntries(PROJECT_STAGES.map((s) => [s.id, 0])) as Record<ProjectStage, number>;
  for (const p of list) if (!p.closed) out[p.stage]++;
  return out;
}

/** «1 проект», «3 проекта», «5 проектов». */
export function pluralProjects(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} проект`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} проекта`;
  return `${n} проектов`;
}

/** Подпись срока шага: «сегодня», «завтра», «просрочено 3 дн.» или дата. */
export function dueText(date: string, todayIso: string): { text: string; overdue: boolean } {
  const [y, m, d] = date.split("-").map(Number);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  const left = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
  if (left < 0) return { text: `просрочено ${-left} дн.`, overdue: true };
  if (left === 0) return { text: "сегодня", overdue: false };
  if (left === 1) return { text: "завтра", overdue: false };
  return { text: `${d} ${MONTHS_GEN[m - 1]}`, overdue: false };
}

const MONTHS_GEN = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
