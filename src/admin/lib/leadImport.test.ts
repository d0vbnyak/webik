import { describe, it, expect } from "vitest";
import { dropDuplicates, leadKeys, parseDate, parseTable, rowsToLeads, scheduleFirstEmails } from "./leadImport";

const rowsOf = (text: string) => parseTable(text).rows;

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
    const r = parseTable('А\tБ\r\n"строка 1\nстрока 2"\t"он сказал ""да"""\r\n');
    expect(r.rows).toEqual([["А", "Б"], ["строка 1\nстрока 2", 'он сказал "да"']]);
    expect(r.unclosedQuote).toBe(false);
  });
  it("CSV с точкой с запятой и BOM, пустые строки выбрасываются", () => {
    expect(rowsOf("﻿a;b\n\n1;2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("кавычка без пары — флаг, а не молчаливая склейка", () => {
    expect(parseTable('a\tb\n"Альфа\t1\nБета\t2').unclosedQuote).toBe(true);
  });
});

describe("parseDate", () => {
  it("русский формат, короткий год и ISO", () => {
    expect(parseDate("15.09.2026")).toBe("2026-09-15");
    expect(parseDate("5.9.26")).toBe("2026-09-05");
    expect(parseDate("2026-09-15")).toBe("2026-09-15");
  });
  it("мусор, несуществующая дата и американский формат → null", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("завтра")).toBeNull();
    expect(parseDate("32.13.2026")).toBeNull();
    expect(parseDate("31.02.2026")).toBeNull();
    expect(parseDate("9/15/2026")).toBeNull();
  });
});

describe("rowsToLeads", () => {
  it("строка из компании.xlsx → лид со всеми полями", () => {
    const { items, errors } = rowsToLeads(rowsOf(`${HEAD}\n${row()}`), "2026-09-15");
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
      next_step: null, // «Не писал» планирует scheduleFirstEmails
    });
    expect(items[0].touches).toEqual([]);
  });

  it("«отправлено» с датами: касание-письмо и вдогонку как следующий шаг", () => {
    const { items } = rowsToLeads(
      rowsOf(`${HEAD}\n${row({ status: "отправлено", sent: "15.09.2026", followup: "21.09.2026", notes: "позвонить Ивану" })}`),
      "2026-09-22",
    );
    expect(items[0].lead).toMatchObject({ stage: "sent", reached_stage: "sent", next_step: "Письмо вдогонку", next_step_date: "2026-09-21" });
    expect(items[0].touches).toEqual([
      { type: "email", date: "2026-09-15", comment: "Первое письмо (из таблицы)" },
      { type: "note", date: "2026-09-22", comment: "позвонить Ивану" },
    ]);
    expect(items[0].stageChangedOn).toBe("2026-09-21");
  });

  it("«отправлено» без даты вдогонку — считаем от даты письма", () => {
    const { items } = rowsToLeads(rowsOf(`${HEAD}\n${row({ status: "отправлено", sent: "15.09.2026" })}`), "2026-09-22");
    expect(items[0].lead.next_step_date).toBe("2026-09-21");
  });

  it("поздние этапы получают шаг по умолчанию — не выпадают из «Сегодня»", () => {
    const { items } = rowsToLeads(rowsOf(`${HEAD}\n${row({ status: "КП" })}`), "2026-09-15");
    expect(items[0].lead).toMatchObject({ stage: "proposal", next_step: "Узнать решение по КП", next_step_date: "2026-09-18" });
  });

  it("отказ после письма: дошёл до «Отправлено», шага нет, дата — по письму", () => {
    const { items } = rowsToLeads(rowsOf(`${HEAD}\n${row({ status: "отказ", sent: "01.09.2026" })}`), "2026-09-15");
    expect(items[0].lead).toMatchObject({ stage: "lost", reached_stage: "sent", next_step: null });
    expect(items[0].stageChangedOn).toBe("2026-09-01");
  });

  it("нераспознанная дата — пояснение по строке", () => {
    const { errors } = rowsToLeads(rowsOf(`${HEAD}\n${row({ status: "отправлено", sent: "9/15/2026" })}`), "2026-09-15");
    expect(errors).toEqual(["Строка 2: дата «9/15/2026» в колонке «Отправлено» не распознана — нужен ДД.ММ.ГГГГ"]);
  });

  it("незнакомый статус и строка без компании — пояснения, а не падение", () => {
    const { items, errors } = rowsToLeads(
      rowsOf(`${HEAD}\n${row({ status: "думают" })}\n${row({ company: "" })}`),
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
    const { items, errors } = rowsToLeads(rowsOf(row()), "2026-09-15");
    expect(items).toEqual([]);
    expect(errors[0]).toContain("Нужны заголовки");
  });
});

describe("dropDuplicates", () => {
  const item = (company: string, website: string | null) => ({ lead: { company, website } });

  it("один сайт в разном написании — дубль", () => {
    const r = dropDuplicates([item("Другое имя", "bastion66.ru")], [{ company: "Бастион", website: "https://www.bastion66.ru/" }]);
    expect(r).toEqual({ fresh: [], skippedNames: ["Другое имя"] });
  });
  it("совпало название, а сайта нет у одной из сторон — дубль", () => {
    expect(dropDuplicates([item("Альфа", null)], [{ company: "ООО «Альфа»", website: "alfa.ru" }]).skippedNames).toEqual(["Альфа"]);
    expect(dropDuplicates([item("ООО Альфа", "alfa.ru")], [{ company: "Альфа", website: null }]).skippedNames).toEqual(["ООО Альфа"]);
  });
  it("одно название, разные сайты — разные компании", () => {
    const r = dropDuplicates([item("ООО Щит", "shit-kzn.ru")], [{ company: "Щит", website: "shit66.ru" }]);
    expect(r.fresh).toHaveLength(1);
    expect(r.skippedNames).toEqual([]);
  });
  it("дубли внутри самой вставки, разные компании проходят", () => {
    const r = dropDuplicates([item("Альфа", "alfa.ru"), item("ООО Альфа", null), item("Бета", "beta.ru")], []);
    expect(r.fresh.map((x) => x.lead.company)).toEqual(["Альфа", "Бета"]);
  });
  it("ключи: домен и название без ООО", () => {
    expect(leadKeys({ company: "ООО «Бастион»", website: "https://www.bastion66.ru/x" })).toEqual({
      site: "bastion66.ru",
      name: "бастион",
    });
  });
});

describe("scheduleFirstEmails", () => {
  const many = (n: number, prio1 = -1) =>
    [HEAD, ...Array.from({ length: n }, (_, i) => row({ company: `К${i}`, site: `k${i}.ru`, priority: i === prio1 ? "1" : "2" }))].join("\n");

  it("по 5 в рабочий день, сначала приоритет 1, с выходного — на понедельник", () => {
    const { items } = rowsToLeads(rowsOf(many(7, 6)), "2026-09-19");
    scheduleFirstEmails(items, "2026-09-19"); // суббота
    const date = (c: string) => items.find((x) => x.lead.company === c)?.lead.next_step_date;
    expect(date("К6")).toBe("2026-09-21"); // приоритет 1 — в первую пятёрку
    expect(items.filter((x) => x.lead.next_step_date === "2026-09-21")).toHaveLength(5);
    expect(items.filter((x) => x.lead.next_step_date === "2026-09-22")).toHaveLength(2);
    expect(items.every((x) => x.lead.next_step === "Отправить первое письмо")).toBe(true);
  });
  it("учитывает письма, уже запланированные в базе", () => {
    const { items } = rowsToLeads(rowsOf(many(4)), "2026-09-15");
    scheduleFirstEmails(items, "2026-09-15", { "2026-09-15": 5, "2026-09-16": 3 });
    expect(items.map((x) => x.lead.next_step_date)).toEqual(["2026-09-16", "2026-09-16", "2026-09-17", "2026-09-17"]);
  });
  it("лиды не на «Не писал» не трогает", () => {
    const { items } = rowsToLeads(rowsOf(`${HEAD}\n${row({ status: "ответили" })}`), "2026-09-15");
    scheduleFirstEmails(items, "2026-09-15");
    expect(items[0].lead.next_step).toBe("Ответить и квалифицировать");
  });
});
