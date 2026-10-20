/**
 * Память бота — один JSON-файл: какие заказы уже видели, что прислали, что
 * отмечено «Не то», как читаются площадки и счётчики по дням для /stats.
 *
 * Из отметок «Не то» бот выводит правила (learnedRules): раздел площадки или
 * слово заголовка, которые раз за разом оказываются лишними, перестают приходить.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { TOPICS } from "./filter";
import type { Job } from "./sources";

/** Сколько ключей помнить. Площадки отдают сотню-другую заказов — запаса на месяцы. */
const SEEN_LIMIT = 20_000;
/** Сколько присланных заказов и отметок держать для обучения. */
const SENT_LIMIT = 3_000;
const DAYS_LIMIT = 90;

export type SentJob = { key: string; title: string; source: string; category: string | null; at: string };

export type SourceStatus = {
  ok: boolean;
  /** Время последней попытки. */
  at: string;
  /** Сколько заказов отдала площадка в последний удачный раз. */
  count: number;
  error?: string;
  /** С какого времени площадка не читается подряд. */
  failingSince?: string;
};

export type DayStats = { read: number; sent: number; rejected: number; muted: number };

export type State = {
  /** Площадки, которые уже прошли первый (немой) проход. */
  sources: string[];
  /** Ключи всех виденных заказов. */
  keys: string[];
  sent: SentJob[];
  rejected: { key: string; at: string }[];
  status: Record<string, SourceStatus>;
  /** Счётчики по дням, ключ — дата YYYY-MM-DD по местному времени. */
  days: Record<string, DayStats>;
  since: string;
  lastCheckAt: string | null;
  /** offset для getUpdates: какие нажатия и команды уже обработаны. */
  updateOffset: number;
};

export function emptyState(now = new Date()): State {
  return { sources: [], keys: [], sent: [], rejected: [], status: {}, days: {}, since: now.toISOString(), lastCheckAt: null, updateOffset: 0 };
}

export async function loadState(path: string): Promise<State> {
  try {
    // Старый формат ({ sources, keys }) дополняется пустыми полями
    return { ...emptyState(), ...(JSON.parse(await readFile(path, "utf8")) as Partial<State>) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
    throw e;
  }
}

let writing: Promise<void> = Promise.resolve();

/**
 * Через временный файл: оборванная запись не испортит память. Записи идут по
 * очереди — рассылка и нажатие кнопки могут сохранять память одновременно.
 */
export function saveState(path: string, state: State): Promise<void> {
  // Обрезаются и списки в памяти процесса: в режиме цикла он живёт неделями
  state.keys = state.keys.slice(-SEEN_LIMIT);
  state.sent = state.sent.slice(-SENT_LIMIT);
  state.rejected = state.rejected.slice(-SENT_LIMIT);
  const days = Object.keys(state.days).sort().slice(-DAYS_LIMIT);
  const data = JSON.stringify({
    ...state,
    days: Object.fromEntries(days.map((d) => [d, state.days[d]])),
  });
  const run = writing.then(async () => {
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, path);
  });
  writing = run.catch(() => {});
  return run;
}

export const dayKey = (d: Date) => d.toLocaleDateString("sv-SE");

export function bump(state: State, field: keyof DayStats, by = 1, now = new Date()): void {
  const day = (state.days[dayKey(now)] ??= { read: 0, sent: 0, rejected: 0, muted: 0 });
  day[field] = Math.max(0, day[field] + by);
}

// ─── Обучение на «Не то» ────────────────────────────────────────────────────

/**
 * Пороги обучения. Осторожные: «Не то» — оценка одного заказа, а на биржах
 * мусора много и в профильных разделах. Раздел выключается, только когда из
 * него пришло от 10 заказов и не меньше 8 из них — 80% — отклонены. Слова
 * учатся, когда всего прислано от 30 заказов: раньше неотклонённых слишком
 * мало, чтобы отличить общее слово от лишнего.
 */
export const LEARN = { categoryMinSent: 10, categoryMinRejects: 8, share: 0.8, wordsAfterSent: 30, wordMinRejects: 3 };

/** Само слово — тема студии («лендинг», «боты»): такое не выучивается, иначе три «Не то» выключат всю тему. */
const isTopicWord = (w: string) => TOPICS.some((t) => t.patterns.some((p) => p.test(w)));

/** Общие основы, которые есть почти в любом заказе: из-за них нельзя выключать заказы. */
const COMMON_STEMS = ["сайт", "нужн", "нужен", "сдела", "срочн", "разра", "созда", "дораб", "настр", "проек", "магаз", "компа", "услуг", "работ", "задач", "помощ", "интег", "прилож", "систем", "сервис"];

/** Основы слов заголовка: от 4 букв, первые 6 знаков — «лендинга» и «лендинг» совпадут. */
export function stems(title: string): Set<string> {
  const words = title.toLowerCase().match(/[a-zа-яё0-9]+/gu) ?? [];
  return new Set(
    words
      .filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !isTopicWord(w) && !COMMON_STEMS.some((c) => w.startsWith(c)))
      .map((w) => w.slice(0, 6)),
  );
}

export type Rules = { categories: string[]; words: string[] };

/**
 * Раздел — лишний, если отклонено почти всё, что из него пришло (пороги — LEARN).
 * Слово — лишнее, если встретилось в 3 отклонённых заголовках и ни в одном
 * неотклонённом. Выученное «замерзает»: из выключенного раздела заказы больше
 * не приходят и долю не исправят — снять правило можно «Вернуть» или /reset.
 */
export function learnedRules(state: State): Rules {
  const rejected = new Set(state.rejected.map((r) => r.key));
  const cats = new Map<string, { sent: number; rejected: number }>();
  const badWords = new Map<string, number>();
  const goodWords = new Set<string>();

  for (const job of state.sent) {
    const isRejected = rejected.has(job.key);
    if (job.category) {
      const c = cats.get(job.category) ?? { sent: 0, rejected: 0 };
      c.sent++;
      if (isRejected) c.rejected++;
      cats.set(job.category, c);
    }
    for (const s of stems(job.title)) {
      if (isRejected) badWords.set(s, (badWords.get(s) ?? 0) + 1);
      else goodWords.add(s);
    }
  }

  return {
    categories: [...cats]
      .filter(([, c]) => c.sent >= LEARN.categoryMinSent && c.rejected >= LEARN.categoryMinRejects && c.rejected / c.sent >= LEARN.share)
      .map(([name]) => name),
    words:
      state.sent.length < LEARN.wordsAfterSent
        ? []
        : [...badWords].filter(([w, n]) => n >= LEARN.wordMinRejects && !goodWords.has(w)).map(([w]) => w),
  };
}

/** Почему заказ отсекает выученное правило, или null. */
export function learnedBlock(job: Pick<Job, "title" | "category">, rules: Rules): string | null {
  if (job.category && rules.categories.includes(job.category)) return `раздел «${job.category}»`;
  const word = [...stems(job.title)].find((s) => rules.words.includes(s));
  return word ? `слово «${word}…»` : null;
}

// ─── /stats ─────────────────────────────────────────────────────────────────

const time = (iso: string) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const date = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
const when = (iso: string, now: Date) => (dayKey(new Date(iso)) === dayKey(now) ? time(iso) : `${date(iso)} ${time(iso)}`);

export function statsText(state: State, sourceNames: string[], now = new Date()): string {
  const today = state.days[dayKey(now)] ?? { read: 0, sent: 0, rejected: 0, muted: 0 };
  const total = Object.values(state.days).reduce(
    (a, d) => ({ read: a.read + d.read, sent: a.sent + d.sent, rejected: a.rejected + d.rejected, muted: a.muted + d.muted }),
    { read: 0, sent: 0, rejected: 0, muted: 0 },
  );
  const line = (d: DayStats) =>
    `новых заказов ${d.read}, прислано ${d.sent}, «Не то» ${d.rejected}` + (d.muted ? `, отсеяно выученным ${d.muted}` : "");

  const lines = [`Сегодня: ${line(today)}`, `С ${date(state.since)}: ${line(total)}`, "", "Площадки:"];
  for (const name of sourceNames) {
    const s = state.status[name];
    if (!s) lines.push(`⏳ ${name} — ещё не проверялась`);
    else if (s.ok) lines.push(`✅ ${name} — ${s.count} заказов, проверено в ${when(s.at, now)}`);
    else lines.push(`❌ ${name} — не читается с ${when(s.failingSince ?? s.at, now)}: ${s.error ?? "ошибка"}`);
  }
  if (state.lastCheckAt) lines.push("", `Последняя проверка: ${when(state.lastCheckAt, now)}`);

  const rules = learnedRules(state);
  lines.push("");
  if (!rules.categories.length && !rules.words.length) {
    lines.push("Фильтр пока ничего не выучил.");
  } else {
    lines.push("Больше не присылаю:");
    for (const c of rules.categories) lines.push(`• раздел «${c}»`);
    for (const w of rules.words) lines.push(`• заголовки со словом «${w}…»`);
    lines.push("Ошиблись — «Вернуть» под заказом или /reset, чтобы забыть все «Не то».");
  }
  // Предел сообщения Telegram — 4096 знаков
  const text = lines.join("\n");
  return text.length > 4000 ? `${text.slice(0, 4000)}\n…` : text;
}
