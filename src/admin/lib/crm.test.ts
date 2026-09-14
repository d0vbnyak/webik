import { describe, it, expect } from "vitest";
import {
  addWorkdays,
  buildStageChange,
  defaultNextStep,
  dueToday,
  funnel,
  lostReasons,
  nextReachedStage,
  stageAfterTouch,
  stageLabel,
} from "./crm";
import type { Lead } from "./types";

describe("addWorkdays", () => {
  it("пн + 4 рабочих = пт", () => {
    expect(addWorkdays("2026-09-14", 4)).toBe("2026-09-18");
  });
  it("перескакивает выходные: пт + 1 = пн", () => {
    expect(addWorkdays("2026-09-18", 1)).toBe("2026-09-21");
  });
  it("как WORKDAY в таблице: 15.09 + 4 = 21.09", () => {
    expect(addWorkdays("2026-09-15", 4)).toBe("2026-09-21");
  });
  it("через границу месяца и года", () => {
    expect(addWorkdays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("defaultNextStep", () => {
  it("после первого письма — вдогонку через 4 рабочих дня", () => {
    expect(defaultNextStep("sent", "2026-09-15")).toEqual({ text: "Письмо вдогонку", date: "2026-09-21" });
  });
  it("на ответ — в тот же день", () => {
    expect(defaultNextStep("replied", "2026-09-15").date).toBe("2026-09-15");
  });
  it("у отказа шага нет", () => {
    expect(defaultNextStep("lost", "2026-09-15")).toEqual({ text: "", date: "" });
  });
});

describe("nextReachedStage", () => {
  it("вперёд — растёт", () => {
    expect(nextReachedStage("sent", "call")).toBe("call");
  });
  it("назад и в отказ — не уменьшается", () => {
    expect(nextReachedStage("proposal", "replied")).toBe("proposal");
    expect(nextReachedStage("proposal", "lost")).toBe("proposal");
  });
});

describe("buildStageChange", () => {
  it("отказ без причины не принимается", () => {
    const r = buildStageChange({ reached_stage: "sent" }, "lost", {});
    expect(r.error).toBe("Укажите причину отказа");
  });
  it("отказ с причиной: достигнутый этап сохраняется", () => {
    const r = buildStageChange({ reached_stage: "call" }, "lost", { lostReason: "price" });
    expect(r.patch).toMatchObject({ stage: "lost", reached_stage: "call", lost_reason: "price", next_step: null });
  });
  it("шаг без даты не принимается", () => {
    const r = buildStageChange({ reached_stage: "sent" }, "replied", { nextStep: "Ответить" });
    expect(r.error).toBe("Укажите дату следующего шага");
  });
  it("выход из отказа сбрасывает причину", () => {
    const r = buildStageChange({ reached_stage: "sent" }, "replied", {
      lostReason: "price",
      nextStep: "Ответить",
      nextStepDate: "2026-09-15",
    });
    expect(r.patch).toMatchObject({ stage: "replied", reached_stage: "replied", lost_reason: null });
  });
});

describe("dueToday", () => {
  const l = (company: string, next_step_date: string | null, priority: number | null = null) => ({
    company,
    next_step_date,
    priority,
  });
  it("берёт наступившие и просроченные, просроченные первыми, будущие и без даты — нет", () => {
    const r = dueToday(
      [l("Будущее", "2026-09-16"), l("Сегодня", "2026-09-15"), l("Вчера", "2026-09-14"), l("Без даты", null)],
      "2026-09-15",
    );
    expect(r.map((x) => x.company)).toEqual(["Вчера", "Сегодня"]);
  });
  it("в один день — сначала приоритет 1", () => {
    const r = dueToday([l("Б", "2026-09-15", 2), l("А", "2026-09-15", 1)], "2026-09-15");
    expect(r.map((x) => x.company)).toEqual(["А", "Б"]);
  });
});

describe("funnel", () => {
  const leads = (stages: Lead["reached_stage"][]) => stages.map((reached_stage) => ({ reached_stage }));

  it("считает дошедших и долю от предыдущего этапа", () => {
    const rows = funnel(leads(["new", "sent", "sent", "sent", "followup", "replied", "call", "proposal"]));
    const by = Object.fromEntries(rows.map((r) => [r.stage, r]));
    expect(by.sent.reached).toBe(7);
    expect(by.replied.reached).toBe(3);
    // ответ считается от отправленных, «вдогонку» не делит воронку
    expect(by.replied.fromPrev).toBe(43);
    expect(by.followup.fromPrev).toBeNull();
    expect(by.check.reached).toBe(2); // созвон и КП прошли через этап «проверка» по порядку
  });
  it("«не писал» в воронку не входит, пустая база — без деления на ноль", () => {
    const rows = funnel(leads(["new"]));
    expect(rows[0].stage).toBe("sent");
    expect(rows.every((r) => r.reached === 0)).toBe(true);
    expect(rows.every((r) => r.fromPrev === null)).toBe(true);
  });
});

describe("lostReasons", () => {
  const lost = (lost_reason: Lead["lost_reason"]) => ({ stage: "lost" as const, lost_reason });

  it("сигнал, если одна причина — больше трети отказов", () => {
    const r = lostReasons([lost("price"), lost("price"), lost("timing"), { stage: "sent", lost_reason: null }]);
    expect(r.total).toBe(3);
    expect(r.rows[0]).toMatchObject({ reason: "price", count: 2, share: 67 });
    expect(r.signal?.reason).toBe("price");
  });
  it("ровно треть — не сигнал; меньше трёх отказов — не сигнал", () => {
    expect(lostReasons([lost("price"), lost("timing"), lost("data")]).signal).toBeNull();
    expect(lostReasons([lost("price"), lost("price")]).signal).toBeNull();
  });
  it("без причины — отдельной строкой", () => {
    expect(lostReasons([lost(null)]).rows[0].label).toBe("без причины");
  });
});

describe("stageAfterTouch", () => {
  it("первое письмо → Отправлено, вдогонку → Вдогонку, КП → КП, созвон → Созвон", () => {
    expect(stageAfterTouch("new", "email")).toBe("sent");
    expect(stageAfterTouch("sent", "followup")).toBe("followup");
    expect(stageAfterTouch("replied", "proposal")).toBe("proposal");
    expect(stageAfterTouch("check", "meeting")).toBe("call");
  });
  it("назад не двигает, повторное письмо и заметка — не этап, из отказа не выводит", () => {
    expect(stageAfterTouch("pilot", "proposal")).toBeNull();
    expect(stageAfterTouch("replied", "email")).toBeNull();
    expect(stageAfterTouch("sent", "note")).toBeNull();
    expect(stageAfterTouch("lost", "meeting")).toBeNull();
  });
});

it("stageLabel", () => {
  expect(stageLabel("proposal")).toBe("КП");
  expect(stageLabel("lost")).toBe("Отказ");
});
