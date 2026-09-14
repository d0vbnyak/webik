// Импорт лидов из таблицы: строки, скопированные из Excel (табуляция), или CSV
// (точка с запятой / запятая). Колонки узнаются по заголовкам компании.xlsx.
// Чистые функции, покрыты leadImport.test.ts.

import { addWorkdays, defaultNextStep, STAGES } from "./crm";
import type { LeadStage, NewLead, NewLeadTouch } from "./types";

export type ImportedLead = {
  lead: NewLead;
  touches: Omit<NewLeadTouch, "lead_id">[];
  /** Дата последнего известного события — для отчёта «за месяц» вместо момента импорта. */
  stageChangedOn: string;
};

export const FIRST_EMAIL_STEP = "Отправить первое письмо";

/**
 * Разбор таблицы с учётом кавычек: в ячейке могут быть переносы строк и разделитель.
 * unclosedQuote — кавычка без пары: остаток вставки слился бы в одну ячейку.
 */
export function parseTable(text: string): { rows: string[][]; unclosedQuote: boolean } {
  const src = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = src.split("\n", 1)[0] ?? "";
  const delim = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return { rows: rows.filter((r) => r.some((c) => c.trim() !== "")), unclosedQuote: quoted };
}

type Field =
  | "company"
  | "inn"
  | "city"
  | "website"
  | "email"
  | "phone"
  | "contact_name"
  | "other_channels"
  | "business"
  | "hook"
  | "variant"
  | "first_line"
  | "priority"
  | "source"
  | "status"
  | "sent"
  | "followup"
  | "notes";

// Заголовок в нижнем регистре без скобок → поле
const HEADERS: Record<string, Field> = {
  "компания": "company",
  "название": "company",
  "инн": "inn",
  "город": "city",
  "сайт": "website",
  "email": "email",
  "e-mail": "email",
  "почта": "email",
  "телефон": "phone",
  "контакт": "contact_name",
  "лпр": "contact_name",
  "другие каналы": "other_channels",
  "чем занимаются": "business",
  "зацепка": "hook",
  "кейс": "variant",
  "вариант письма": "variant",
  "первая строка письма": "first_line",
  "приоритет": "priority",
  "источник": "source",
  "статус": "status",
  "отправлено": "sent",
  "вдогонку": "followup",
  "ответ / заметки": "notes",
  "заметки": "notes",
};

function headerField(raw: string): Field | undefined {
  const key = raw.toLowerCase().replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  return HEADERS[key];
}

const STATUS_BY_LABEL: Record<string, LeadStage> = {
  ...Object.fromEntries(STAGES.map((s) => [s.label.toLowerCase(), s.id])),
  "отказ": "lost",
};

/** «15.09.2026», «15.09.26» или «2026-09-15» → ISO. Несуществующая дата или другой формат → null. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const ru = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (ru) {
    [y, m, d] = [Number(ru[3].length === 2 ? `20${ru[3]}` : ru[3]), Number(ru[2]), Number(ru[1])];
  } else {
    return null;
  }
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Ключи для поиска дублей: домен сайта (или "") и название без ООО и кавычек. */
export function leadKeys(l: { company: string; website: string | null }): { site: string; name: string } {
  const site = (l.website ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
  const name = l.company
    .toLowerCase()
    .replace(/[«»"'.,]/g, " ")
    // \b в JS не видит кириллицу — границы слова задаём пробелами
    .replace(/(^|\s)(ооо|ип|ао|пао|зао)(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { site, name };
}

/**
 * Убирает дубли — и с базой, и внутри самой вставки. Совпал сайт — дубль.
 * Совпало название — дубль, только если хотя бы у одной стороны нет сайта:
 * «Щит» из Екатеринбурга и «Щит» из Казани с разными сайтами — разные компании.
 */
export function dropDuplicates<T extends { lead: { company: string; website: string | null } }>(
  items: T[],
  existing: { company: string; website: string | null }[],
): { fresh: T[]; skippedNames: string[] } {
  const sites = new Set<string>();
  const names = new Set<string>(); // все известные названия
  const namesWithoutSite = new Set<string>(); // названия, у которых нет сайта
  const remember = (k: { site: string; name: string }) => {
    if (k.site) sites.add(k.site);
    if (k.name) {
      names.add(k.name);
      if (!k.site) namesWithoutSite.add(k.name);
    }
  };
  existing.forEach((l) => remember(leadKeys(l)));

  const fresh: T[] = [];
  const skippedNames: string[] = [];
  for (const item of items) {
    const k = leadKeys(item.lead);
    const dup = k.site
      ? sites.has(k.site) || (!!k.name && namesWithoutSite.has(k.name))
      : !!k.name && names.has(k.name);
    if (dup) {
      skippedNames.push(item.lead.company);
      continue;
    }
    remember(k);
    fresh.push(item);
  }
  return { fresh, skippedNames };
}

const orNull = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

/**
 * Строки таблицы → лиды. Первая непустая строка — заголовки. Строки без названия
 * компании пропускаются с пояснением. Следующий шаг ставится всем, кроме
 * «Не писал» (им — scheduleFirstEmails) и отказов, иначе лид молча выпадет из «Сегодня».
 */
export function rowsToLeads(rows: string[][], todayIso: string): { items: ImportedLead[]; errors: string[] } {
  const errors: string[] = [];
  if (rows.length < 2) return { items: [], errors: ["Нужны заголовки и хотя бы одна строка"] };

  const fields = rows[0].map(headerField);
  if (!fields.includes("company")) {
    return { items: [], errors: ["Не нашёл колонку «Компания» — скопируйте таблицу вместе с заголовками"] };
  }

  const items: ImportedLead[] = [];
  rows.slice(1).forEach((cells, i) => {
    const get = (f: Field) => {
      const idx = fields.indexOf(f);
      return idx >= 0 ? (cells[idx] ?? "") : "";
    };
    const line = i + 2;
    const company = get("company").trim();
    if (!company) {
      errors.push(`Строка ${line}: нет названия компании — пропущена`);
      return;
    }

    const statusRaw = get("status").trim().toLowerCase();
    let stage: LeadStage = "new";
    if (statusRaw) {
      const found = STATUS_BY_LABEL[statusRaw];
      if (found) stage = found;
      else errors.push(`Строка ${line}: статус «${get("status")}» не знаю — поставил «Не писал»`);
    }

    const date = (f: Field, label: string) => {
      const raw = get(f).trim();
      if (!raw) return null;
      const parsed = parseDate(raw);
      if (!parsed) errors.push(`Строка ${line}: дата «${raw}» в колонке «${label}» не распознана — нужен ДД.ММ.ГГГГ`);
      return parsed;
    };
    const sent = date("sent", "Отправлено");
    const followup = date("followup", "Вдогонку");

    const touches: ImportedLead["touches"] = [];
    if (sent) touches.push({ type: "email", date: sent, comment: "Первое письмо (из таблицы)" });
    const notes = orNull(get("notes"));
    if (notes) touches.push({ type: "note", date: todayIso, comment: notes });

    let nextStep: { text: string; date: string } | null = null;
    if (stage === "sent") {
      // Дата «Вдогонку» в таблице — план, а не факт. Нет её — считаем от даты письма
      nextStep = { text: "Письмо вдогонку", date: followup ?? addWorkdays(sent ?? todayIso, 4) };
    } else if (stage !== "new" && stage !== "lost") {
      nextStep = defaultNextStep(stage, todayIso);
    }

    // Письмо уходило — лид дошёл до «Отправлено», даже если потом отказ
    const reached: NewLead["reached_stage"] = stage === "lost" ? (sent ? "sent" : "new") : stage;
    const priorityNum = Number.parseInt(get("priority"), 10);

    items.push({
      lead: {
        company,
        inn: orNull(get("inn")),
        city: orNull(get("city")),
        website: orNull(get("website")),
        email: orNull(get("email")),
        phone: orNull(get("phone")),
        contact_name: orNull(get("contact_name")),
        telegram_username: null,
        other_channels: orNull(get("other_channels")),
        business: orNull(get("business")),
        hook: orNull(get("hook")),
        variant: orNull(get("variant")),
        first_line: orNull(get("first_line")),
        priority: priorityNum === 1 || priorityNum === 2 ? priorityNum : null,
        source: orNull(get("source")) ?? "Холодное письмо",
        stage,
        reached_stage: reached,
        lost_reason: null,
        next_step: nextStep?.text ?? null,
        next_step_date: nextStep?.date ?? null,
        deal_amount: null,
        client_id: null,
      },
      touches,
      stageChangedOn: [sent, followup].filter((d): d is string => !!d && d <= todayIso).sort().pop() ?? todayIso,
    });
  });
  return { items, errors };
}

/** Первый рабочий день начиная с даты (сама дата, если это пн–пт). */
function firstWorkday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6 ? addWorkdays(iso, 1) : iso;
}

/**
 * «Не писал» без даты → «Отправить первое письмо», не больше perDay в рабочий день,
 * сначала приоритет 1. booked — сколько первых писем уже стоит на каждую дату в базе.
 * Норматив из скриптов — 4–5 писем в день, так «Сегодня» не превращается в список
 * из всей базы. Вызывать после удаления дублей.
 */
export function scheduleFirstEmails<T extends ImportedLead>(
  items: T[],
  todayIso: string,
  booked: Record<string, number> = {},
  perDay = 5,
): T[] {
  const queue = items
    .map((item, order) => ({ item, order }))
    .filter(({ item }) => item.lead.stage === "new" && !item.lead.next_step_date)
    .sort((a, b) => (a.item.lead.priority ?? 9) - (b.item.lead.priority ?? 9) || a.order - b.order);

  const load = { ...booked };
  let day = firstWorkday(todayIso);
  for (const { item } of queue) {
    while ((load[day] ?? 0) >= perDay) day = addWorkdays(day, 1);
    load[day] = (load[day] ?? 0) + 1;
    item.lead.next_step = FIRST_EMAIL_STEP;
    item.lead.next_step_date = day;
  }
  return items;
}
