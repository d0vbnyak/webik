import { describe, it, expect } from "vitest";
import { normalizePhone, callLink, telegramLink, maxLinkOf, messengerLinks } from "./phone";

describe("normalizePhone", () => {
  it("убирает всё кроме цифр", () => {
    expect(normalizePhone("+7 (900) 123-45-67")).toBe("79001234567");
  });
  it("ведущая 8 (РФ) → 7", () => {
    expect(normalizePhone("8 (900) 123-45-67")).toBe("79001234567");
  });
  it("пустой/null → пустая строка", () => {
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone("")).toBe("");
  });
});

describe("callLink", () => {
  it("по нормализованному номеру", () => {
    expect(callLink("8 (900) 123-45-67")).toBe("tel:+79001234567");
  });
  it("нет телефона → null", () => {
    expect(callLink("")).toBeNull();
  });
});

describe("telegramLink", () => {
  it("по username (приоритет)", () => {
    expect(telegramLink("ivan", "89001234567")).toBe("https://t.me/ivan");
  });
  it("username с @ → @ убирается", () => {
    expect(telegramLink("@ivan", null)).toBe("https://t.me/ivan");
  });
  it("без username, но с телефоном → tg://resolve", () => {
    expect(telegramLink(null, "89001234567")).toBe("tg://resolve?phone=79001234567");
  });
  it("ни того, ни другого → null", () => {
    expect(telegramLink(null, "")).toBeNull();
  });
});

describe("maxLinkOf", () => {
  it("возвращает ссылку, если заполнена", () => {
    expect(maxLinkOf("https://max.ru/u/abc")).toBe("https://max.ru/u/abc");
  });
  it("пусто/пробелы/null → null", () => {
    expect(maxLinkOf("   ")).toBeNull();
    expect(maxLinkOf(null)).toBeNull();
  });
});

describe("messengerLinks (видимость по правилам)", () => {
  it("только max_link → виден только MAX", () => {
    const r = messengerLinks({ phone: null, telegram_username: null, max_link: "https://max.ru/u/abc" });
    expect(r.call).toBeNull();
    expect(r.telegram).toBeNull();
    expect(r.max).toBe("https://max.ru/u/abc");
  });
  it("есть телефон → звонок и Telegram(по телефону) видны, MAX нет", () => {
    const r = messengerLinks({ phone: "89001234567", telegram_username: null, max_link: null });
    expect(r.call).toBe("tel:+79001234567");
    expect(r.telegram).toBe("tg://resolve?phone=79001234567");
    expect(r.max).toBeNull();
  });
});
