import { describe, expect, it } from "vitest";
import {
  countByStage,
  daysSince,
  defaultProjectStep,
  dueText,
  domainOf,
  normalizeUrl,
  pluralProjects,
  projectsDue,
  slugError,
  slugFromUrl,
  stageReached,
  waitingOnClient,
} from "./projects";
import { parsePluginUpdate, stageAfterSync } from "../../../shared/projects";

describe("projects", () => {
  it("домен и slug из ссылки — как в плагине", () => {
    expect(domainOf("https://www.stroymir.ru/old/page.html")).toBe("stroymir.ru");
    expect(domainOf("zerno-cafe.ru")).toBe("zerno-cafe.ru");
    expect(domainOf(null)).toBeNull();
    expect(slugFromUrl("https://www.stroymir.ru/")).toBe("stroymir");
    expect(slugFromUrl("https://Zerno_Cafe.ru")).toBe("zerno-cafe");
    expect(slugError("stroymir")).toBeNull();
    expect(slugError("-bad")).not.toBeNull();
    expect(slugError("Строймир")).not.toBeNull();
  });

  it("ссылка из ввода: без схемы — https, мусор — ошибка", () => {
    expect(normalizeUrl("stroymir.ru")).toEqual({ url: "https://stroymir.ru/", error: null });
    expect(normalizeUrl("  ")).toEqual({ url: null, error: null });
    expect(normalizeUrl("просто текст").error).not.toBeNull();
  });

  it("дела на сегодня: наступившие, без закрытых, просроченные первыми", () => {
    const list = [
      { name: "Б", next_step_date: "2026-10-19", closed: false },
      { name: "А", next_step_date: "2026-10-15", closed: false },
      { name: "В", next_step_date: "2026-10-20", closed: false },
      { name: "Г", next_step_date: "2026-10-10", closed: true },
      { name: "Д", next_step_date: null, closed: false },
    ];
    expect(projectsDue(list, "2026-10-19").map((p) => p.name)).toEqual(["А", "Б"]);
  });

  it("ждём клиента — только открытые демо, дольше ждущие выше", () => {
    const list = [
      { stage: "demo" as const, closed: false, stage_changed_at: "2026-10-10T10:00:00Z" },
      { stage: "demo" as const, closed: false, stage_changed_at: "2026-10-01T10:00:00Z" },
      { stage: "demo" as const, closed: true, stage_changed_at: "2026-09-01T10:00:00Z" },
      { stage: "built" as const, closed: false, stage_changed_at: "2026-09-01T10:00:00Z" },
    ];
    expect(waitingOnClient(list).map((p) => p.stage_changed_at)).toEqual(["2026-10-01T10:00:00Z", "2026-10-10T10:00:00Z"]);
  });

  it("шкала этапов и счётчики", () => {
    expect(stageReached("built", "audited")).toBe("done");
    expect(stageReached("built", "built")).toBe("current");
    expect(stageReached("built", "prod")).toBe("ahead");
    expect(countByStage([{ stage: "demo", closed: false }, { stage: "demo", closed: true }, { stage: "audited", closed: false }])).toEqual({
      audited: 1, designing: 0, built: 0, demo: 1, prod: 0,
    });
  });

  it("шаг по умолчанию, дни ожидания, склонение", () => {
    expect(defaultProjectStep("audited", "2026-10-19")).toEqual({ text: expect.any(String), date: "2026-10-19" });
    expect(defaultProjectStep("demo", "2026-10-16").date).toBe("2026-10-21"); // пт + 3 рабочих
    expect(daysSince("2026-10-12T12:00:00", "2026-10-19")).toBe(7);
    expect(pluralProjects(1)).toBe("1 проект");
    expect(pluralProjects(3)).toBe("3 проекта");
    expect(pluralProjects(11)).toBe("11 проектов");
  });

  it("подпись срока", () => {
    expect(dueText("2026-10-16", "2026-10-19")).toEqual({ text: "просрочено 3 дн.", overdue: true });
    expect(dueText("2026-10-19", "2026-10-19").text).toBe("сегодня");
    expect(dueText("2026-10-20", "2026-10-19").text).toBe("завтра");
    expect(dueText("2026-11-02", "2026-10-19").text).toBe("2 ноя");
  });

  it("обновление от плагина: проверка полей и запрет отката с прода", () => {
    expect(parsePluginUpdate({ slug: "stroymir", stage: "demo", demo_url: "https://stroymir.demo.webik.tech", updated: "x" })).toEqual({
      slug: "stroymir", stage: "demo", name: null, source_url: null, design_artifact_url: null, demo_url: "https://stroymir.demo.webik.tech/",
    });
    expect(parsePluginUpdate({ slug: "Stroy Mir", stage: "demo" })).toHaveProperty("error");
    expect(parsePluginUpdate({ slug: "ok", stage: "prod" })).toHaveProperty("error");
    expect(parsePluginUpdate({ slug: "ok", stage: "demo", source_url: "ftp://x.ru" })).toHaveProperty("error");
    expect(stageAfterSync("prod", "built")).toBe("prod");
    expect(stageAfterSync("demo", "built")).toBe("built");
    expect(stageAfterSync(null, "audited")).toBe("audited");
  });
});
