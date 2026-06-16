import { describe, it, expect } from "vitest";
import { normalizePhone, whatsappLink, telegramLink, messengerLinks } from "./phone";

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

describe("whatsappLink", () => {
  it("по нормализованному номеру", () => {
    expect(whatsappLink("89001234567")).toBe("https://wa.me/79001234567");
  });
  it("нет телефона → null", () => {
    expect(whatsappLink("")).toBeNull();
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

describe("messengerLinks (видимость по правилам)", () => {
  it("только max_link → виден только MAX", () => {
    const r = messengerLinks({ phone: null, telegram_username: null, max_link: "https://max.ru/u/abc" });
    expect(r.whatsapp).toBeNull();
    expect(r.telegram).toBeNull();
    expect(r.max).toBe("https://max.ru/u/abc");
  });
  it("есть телефон → WhatsApp и Telegram(по телефону) видны, MAX нет", () => {
    const r = messengerLinks({ phone: "89001234567", telegram_username: null, max_link: null });
    expect(r.whatsapp).toBe("https://wa.me/79001234567");
    expect(r.telegram).toBe("tg://resolve?phone=79001234567");
    expect(r.max).toBeNull();
  });
});
