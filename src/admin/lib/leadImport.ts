// Импорт лидов из таблицы: строки, скопированные из Excel (табуляция), или CSV
// (точка с запятой / запятая). Колонки узнаются по заголовкам компании.xlsx.
// Чистые функции, покрыты leadImport.test.ts.

import { addWorkdays, STAGES } from "./crm";
import type { LeadStage, NewLead, NewLeadTouch } from "./types";

export type ImportedLead = {
  lead: NewLead;
  touches: Omit<NewLeadTouch, "lead_id">[];
};

/** Разбор таблицы с учётом кавычек: в ячейке могут быть переносы строк и разделитель. */
export function parseTable(text: string): string[][] {
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
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
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

/** «15.09.2026», «15.09.26» или «2026-09-15» → ISO. Иначе null. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ru = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!ru) return null;
  const year = ru[3].length === 2 ? `20${ru[3]}` : ru[3];
  return `${year}-${ru[2].padStart(2, "0")}-${ru[1].padStart(2, "0")}`;
}

/** Ключ для поиска дублей: домен сайта, а без сайта — название без ООО и кавычек. */
export function leadKey(l: { company: string; website: string | null }): string {
  if (l.website?.trim()) {
    const host = l.website
      .trim()
      .toLowerCase()
      .replace(/^[a-z]+:\/\//, "")
      .replace(/^www\./, "")
      .split(/[/?#]/)[0];
    if (host) return `site:${host}`;
  }
  const name = l.company
    .toLowerCase()
    .replace(/[«»"'.,]/g, " ")
    // \b в JS не видит кириллицу — границы слова задаём пробелами
    .replace(/(^|\s)(ооо|ип|ао|пао|зао)(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `name:${name}`;
}

const orNull = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

/**
 * Строки таблицы → лиды. Первая непустая строка — заголовки. Строки без названия
 * компании пропускаются с пояснением.
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

    const priorityNum = Number.parseInt(get("priority"), 10);
    const sent = parseDate(get("sent"));
    const followup = parseDate(get("followup"));
    const touches: ImportedLead["touches"] = [];
    if (sent) touches.push({ type: "email", date: sent, comment: "Первое письмо (из таблицы)" });
    const notes = orNull(get("notes"));
    if (notes) touches.push({ type: "note", date: todayIso, comment: notes });

    // Дата «Вдогонку» в таблице — план, а не факт: для «Отправлено» это следующий шаг
    const nextStep = stage === "sent" && followup ? { text: "Письмо вдогонку", date: followup } : null;

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
        reached_stage: stage === "lost" ? "new" : stage,
        lost_reason: null,
        next_step: nextStep?.text ?? null,
        next_step_date: nextStep?.date ?? null,
        deal_amount: null,
        client_id: null,
      },
      touches,
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
 * «Не писал» без даты → «Отправить первое письмо», по perDay в рабочий день,
 * сначала приоритет 1. Норматив из скриптов — 4–5 писем в день, так «Сегодня»
 * не превращается в список из всей базы.
 */
export function scheduleFirstEmails(items: ImportedLead[], todayIso: string, perDay = 5): ImportedLead[] {
  const queue = items
    .map((item, order) => ({ item, order }))
    .filter(({ item }) => item.lead.stage === "new" && !item.lead.next_step_date)
    .sort((a, b) => (a.item.lead.priority ?? 9) - (b.item.lead.priority ?? 9) || a.order - b.order);

  let day = firstWorkday(todayIso);
  queue.forEach(({ item }, i) => {
    if (i > 0 && i % perDay === 0) day = addWorkdays(day, 1);
    item.lead.next_step = "Отправить первое письмо";
    item.lead.next_step_date = day;
  });
  return items;
}
