import { describe, expect, it } from "vitest";
import { ORDER_LIMITS, formatOrder, validateOrder } from "./order";

describe("validateOrder", () => {
  it("принимает заявку и обрезает пробелы", () => {
    expect(validateOrder({ name: " Иван ", contact: " @ivan ", task: " бот ", details: "" })).toEqual({
      name: "Иван",
      contact: "@ivan",
      task: "бот",
      details: "",
    });
  });

  it("имя и детали необязательны, лишние поля отбрасываются", () => {
    expect(validateOrder({ contact: "+7 900 000-00-00", task: "лендинг", website: "x" })).toEqual({
      name: "",
      contact: "+7 900 000-00-00",
      task: "лендинг",
      details: "",
    });
  });

  it("без контакта или задачи — ошибка", () => {
    expect(validateOrder({ task: "бот" })).toHaveProperty("error");
    expect(validateOrder({ contact: "@ivan", task: "   " })).toHaveProperty("error");
  });

  it("контакт — не пунктуация", () => {
    expect(validateOrder({ contact: "---", task: "бот" })).toHaveProperty("error");
  });

  it("в имени и контакте нельзя нарисовать лишние строки", () => {
    const order = validateOrder({ name: "Иван\nКонтакт: @fake\u2028x\u202e", contact: "@ivan\r\n", task: "бот\nпо шагам" });
    expect(order).toMatchObject({ name: "Иван Контакт: @fake x", contact: "@ivan", task: "бот\nпо шагам" });
  });

  it("длинные поля и не-объект отклоняются", () => {
    expect(validateOrder({ contact: "@ivan", task: "x".repeat(ORDER_LIMITS.task + 1) })).toHaveProperty("error");
    expect(validateOrder(null)).toHaveProperty("error");
    expect(validateOrder(["@ivan"])).toHaveProperty("error");
    expect(validateOrder({ contact: 123, task: "бот" })).toHaveProperty("error");
  });
});

describe("formatOrder", () => {
  it("пишет источник и пропускает пустые детали", () => {
    const text = formatOrder({ name: "", contact: "@ivan", task: "бот", details: "" }, "assistant");
    expect(text).toContain("ИИ-ассистент");
    expect(text).toContain("Имя: не назвался");
    expect(text).toContain("Контакт: @ivan");
    expect(text).not.toContain("Детали");
    expect(formatOrder({ name: "И", contact: "@i", task: "т", details: "до 50 тыс." }, "form")).toContain(
      "Детали: до 50 тыс.",
    );
  });
});
