import { describe, expect, it, vi } from "vitest";
import { ORDER_RATE, OrderLimiter, submitOrder, telegramNotifierFromEnv } from "./orders";
import type { Order } from "../shared/order";

const ORDER: Order = { name: "Иван", contact: "@ivan", task: "бот поддержки", details: "" };

describe("telegramNotifierFromEnv", () => {
  it("без токена или чата — null", () => {
    expect(telegramNotifierFromEnv({})).toBeNull();
    expect(telegramNotifierFromEnv({ TELEGRAM_BOT_TOKEN: "t" })).toBeNull();
    expect(telegramNotifierFromEnv({ TELEGRAM_CHAT_ID: "1" })).toBeNull();
  });

  it("ADMIN_CHAT_ID от support-bot не подхватывается", () => {
    expect(telegramNotifierFromEnv({ TELEGRAM_BOT_TOKEN: "t", ADMIN_CHAT_ID: "42" })).toBeNull();
  });

  it("шлёт sendMessage без разметки", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const notify = telegramNotifierFromEnv({ TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_ID: "42" }, fetchMock);
    await notify!("<b>текст</b>");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ chat_id: "42", text: "<b>текст</b>" });
    expect(body).not.toHaveProperty("parse_mode");
  });

  it("ответ не 2xx — ошибка без токена в тексте", async () => {
    const fetchMock = vi.fn(async () => new Response('{"description":"chat not found"}', { status: 400 }));
    const notify = telegramNotifierFromEnv({ TELEGRAM_BOT_TOKEN: "123:secret", TELEGRAM_CHAT_ID: "1" }, fetchMock);
    const error = await notify!("x").catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("chat not found");
    expect((error as Error).message).not.toContain("secret");
  });
});

describe("OrderLimiter", () => {
  it("лимит на адрес сбрасывается через окно", () => {
    let now = Date.UTC(2026, 8, 15, 10);
    const limiter = new OrderLimiter(() => now);
    for (let i = 0; i < ORDER_RATE.perIp; i++) expect(limiter.take("1.1.1.1")).toBe(true);
    expect(limiter.take("1.1.1.1")).toBe(false);
    expect(limiter.take("2.2.2.2")).toBe(true);
    now += ORDER_RATE.windowMs;
    expect(limiter.take("1.1.1.1")).toBe(true);
  });

  it("дневной потолок на весь сайт", () => {
    const limiter = new OrderLimiter(() => Date.UTC(2026, 8, 15, 10));
    for (let i = 0; i < ORDER_RATE.perDay; i++) expect(limiter.take(`10.0.0.${i}`)).toBe(true);
    expect(limiter.take("10.0.1.1")).toBe(false);
  });
});

describe("submitOrder", () => {
  it("адреса IPv6 из одной /64 делят лимит", async () => {
    const limiter = new OrderLimiter();
    const notify = async () => {};
    for (let i = 1; i <= ORDER_RATE.perIp; i++) {
      expect(await submitOrder(ORDER, "form", `2001:db8:1:2::${i}`, { notify, limiter })).toEqual({ ok: true });
    }
    expect(await submitOrder(ORDER, "form", "2001:db8:1:2::ffff", { notify, limiter })).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("не настроен / лимит / сбой Telegram — причина, а не исключение", async () => {
    const limiter = new OrderLimiter();
    expect(await submitOrder(ORDER, "form", "ip", { notify: null, limiter })).toEqual({ ok: false, reason: "not_configured" });

    const failing = vi.fn(async () => {
      throw new Error("network");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await submitOrder(ORDER, "form", "ip", { notify: failing, limiter })).toEqual({ ok: false, reason: "failed" });

    const ok = vi.fn(async (_text: string) => {});
    expect(await submitOrder(ORDER, "assistant", "ip", { notify: ok, limiter })).toEqual({ ok: true });
    expect(ok.mock.calls[0][0]).toContain("ИИ-ассистент");

    await submitOrder(ORDER, "form", "ip", { notify: ok, limiter });
    expect(await submitOrder(ORDER, "form", "ip", { notify: ok, limiter })).toEqual({ ok: false, reason: "rate_limited" });
  });
});
