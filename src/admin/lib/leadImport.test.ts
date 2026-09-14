import { describe, it, expect } from "vitest";
import { leadKey, parseDate, parseTable, rowsToLeads, scheduleFirstEmails } from "./leadImport";

// Заголовки — как в outreach/компании.xlsx
const HEAD = [
  "№", "Приоритет", "Компания", "Город", "Сайт", "Email", "Телефон", "Другие каналы",
  "Чем занимаются", "Зацепка (с их сайта)", "Кейс", "Первая строка письма", "Статус",
  "Отправлено", "Вдогонку", "Ответ / заметки",
].join("\t");

const row = (over: Partial<Record<string, string>> = {}) =>
  [
    "1", over.priority ?? "1", over.company ?? "ООО «Бастион»", "Екатеринбург",
    over.site ?? "https://www.bastion66.ru", "info@bastion66.ru", "+7 (343) 355-55-76", "",
    "Видеонаблюдение", "Форма заявки на ремонт", "А — заявки", over.firstLine ?? "Увидел у вас форму",
    over.status ?? "не писал", over.sent ?? "", over.followup ?? "", over.notes ?? "",
  ].join("\t");

describe("parseTable", () => {
  it("табуляция из Excel, ячейка в кавычках с переносом строки и кавычками", () => {
    const rows = parseTable('А\tБ\r\n"строка 1\nстрока 2"\t"он сказал ""да"""\r\n');
    expect(rows).toEqual([["А", "Б"], ["строка 1\nстрока 2", 'он сказал "да"']]);
  });
  it("CSV с точкой с запятой и BOM, пустые строки выбрасываются", () => {
    expect(parseTable("﻿a;b\n\n1;2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseDate", () => {
  it("русский формат, короткий год и ISO", () => {
    expect(parseDate("15.09.2026")).toBe("2026-09-15");
    expect(parseDate("5.9.26")).toBe("2026-09-05");
    expect(parseDate("2026-09-15")).toBe("2026-09-15");
  });
  it("мусор → null", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("завтра")).toBeNull();
  });
});

describe("rowsToLeads", () => {
  it("строка из компании.xlsx → лид со всеми полями", () => {
    const { items, errors } = rowsToLeads(parseTable(`${HEAD}\n${row()}`), "2026-09-15");
    expect(errors).toEqual([]);
    expect(items[0].lead).toMatchObject({
      company: "ООО «Бастион»",
      city: "Екатеринбург",
      website: "https://www.bastion66.ru",
      email: "info@bastion66.ru",
      hook: "Форма заявки на ремонт",
      variant: "А — заявки",
      first_line: "Увидел у вас форму",
      priority: 1,
      source: "Холодное письмо",
      stage: "new",
      reached_stage: "new",
      other_channels: null,
    });
    expect(items[0].touches).toEqual([]);
  });

  it("«отправлено» с датами: касание-письмо и вдогонку как следующий шаг", () => {
    const { items } = rowsToLeads(
      parseTable(`${HEAD}\n${row({ status: "отправлено", sent: "15.09.2026", followup: "21.09.2026", notes: "позвонить Ивану" })}`),
      "2026-09-22",
    );
    expect(items[0].lead).toMatchObject({ stage: "sent", reached_stage: "sent", next_step: "Письмо вдогонку", next_step_date: "2026-09-21" });
    expect(items[0].touches).toEqual([
      { type: "email", date: "2026-09-15", comment: "Первое письмо (из таблицы)" },
      { type: "note", date: "2026-09-22", comment: "позвонить Ивану" },
    ]);
  });

  it("незнакомый статус и строка без компании — пояснения, а не падение", () => {
    const { items, errors } = rowsToLeads(
      parseTable(`${HEAD}\n${row({ status: "думают" })}\n${row({ company: "" })}`),
      "2026-09-15",
    );
    expect(items).toHaveLength(1);
    expect(items[0].lead.stage).toBe("new");
    expect(errors).toEqual([
      "Строка 2: статус «думают» не знаю — поставил «Не писал»",
      "Строка 3: нет названия компании — пропущена",
    ]);
  });

  it("без заголовков — понятная ошибка", () => {
    const { items, errors } = rowsToLeads(parseTable(row()), "2026-09-15");
    expect(items).toEqual([]);
    expect(errors[0]).toContain("Нужны заголовки");
  });
});

describe("leadKey", () => {
  it("один сайт в разном написании — один ключ", () => {
    expect(leadKey({ company: "A", website: "https://www.bastion66.ru/" })).toBe(
      leadKey({ company: "B", website: "bastion66.ru" }),
    );
  });
  it("без сайта — по названию без ООО и кавычек", () => {
    expect(leadKey({ company: "ООО «Бастион»", website: null })).toBe("name:бастион");
    expect(leadKey({ company: "Бастион", website: "  " })).toBe("name:бастион");
  });
});

describe("scheduleFirstEmails", () => {
  it("по 5 в рабочий день, сначала приоритет 1, с выходного — на понедельник", () => {
    const text = [HEAD, ...Array.from({ length: 7 }, (_, i) => row({ company: `К${i}`, site: `k${i}.ru`, priority: i === 6 ? "1" : "2" }))].join("\n");
    const { items } = rowsToLeads(parseTable(text), "2026-09-19");
    scheduleFirstEmails(items, "2026-09-19"); // суббота
    const date = (c: string) => items.find((x) => x.lead.company === c)?.lead.next_step_date;
    expect(date("К6")).toBe("2026-09-21"); // приоритет 1 — в первую пятёрку
    expect(items.filter((x) => x.lead.next_step_date === "2026-09-21")).toHaveLength(5);
    expect(items.filter((x) => x.lead.next_step_date === "2026-09-22")).toHaveLength(2);
    expect(items.every((x) => x.lead.next_step === "Отправить первое письмо")).toBe(true);
  });
  it("лиды не на «Не писал» не трогает", () => {
    const { items } = rowsToLeads(parseTable(`${HEAD}\n${row({ status: "ответили" })}`), "2026-09-15");
    scheduleFirstEmails(items, "2026-09-15");
    expect(items[0].lead.next_step).toBeNull();
  });
});
