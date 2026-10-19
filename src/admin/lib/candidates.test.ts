import { describe, expect, it } from "vitest";
import { freshCandidates, parseCandidatesJson, problemList, sortCandidates } from "./candidates";

describe("candidates", () => {
  it("импорт: нормализует ссылку и домен, проблемы списком склеиваются строками", () => {
    const { items, errors } = parseCandidatesJson(
      JSON.stringify([
        { name: " Дентал ", site_url: "www.Dental37.ru/", city: "Кинешма", problems: ["нет адаптива", " ", "таблицы"], score: 7.4 },
      ]),
    );
    expect(errors).toEqual([]);
    expect(items[0]).toMatchObject({
      name: "Дентал",
      site_url: "https://www.dental37.ru/",
      domain: "dental37.ru",
      city: "Кинешма",
      problems: "нет адаптива\nтаблицы",
      score: 7,
      status: "new",
    });
  });

  it("импорт: плохие строки и дубли внутри файла — в ошибки, остальное проходит", () => {
    const { items, errors } = parseCandidatesJson(
      JSON.stringify([
        { name: "А", site_url: "a.ru" },
        { name: "", site_url: "b.ru" },
        { name: "В", site_url: "javascript:alert(1)" },
        { name: "Г", site_url: "https://www.a.ru/page" },
        "строка",
      ]),
    );
    expect(items.map((i) => i.domain)).toEqual(["a.ru"]);
    expect(errors).toHaveLength(4);
    expect(parseCandidatesJson("{").errors[0]).toContain("JSON");
    expect(parseCandidatesJson("{}").errors[0]).toContain("массив");
  });

  it("кириллический домен в punycode проходит, кириллица как есть — нормализуется браузерным URL", () => {
    const { items } = parseCandidatesJson(JSON.stringify([{ name: "Окна", site_url: "окна-ногинск.рф" }]));
    expect(items[0].domain).toMatch(/^xn--/);
  });

  it("дубли с базой, сортировка, проблемы", () => {
    const { fresh, skipped } = freshCandidates([{ domain: "a.ru" }, { domain: "b.ru" }], [{ domain: "a.ru" }]);
    expect(fresh).toEqual([{ domain: "b.ru" }]);
    expect(skipped).toEqual([{ domain: "a.ru" }]);
    const sorted = sortCandidates([
      { name: "Б", status: "declined" as const, score: 9 },
      { name: "А", status: "new" as const, score: 5 },
      { name: "В", status: "new" as const, score: 8 },
      { name: "Г", status: "contacted" as const, score: 1 },
    ]);
    expect(sorted.map((c) => c.name)).toEqual(["В", "А", "Г", "Б"]);
    expect(problemList("a\n\n b ")).toEqual(["a", "b"]);
    expect(problemList(null)).toEqual([]);
  });
});
