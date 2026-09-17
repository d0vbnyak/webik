import { afterEach, describe, expect, it, vi } from "vitest";
import { formatRub, suggestOpener, variantFromLetter } from "./ai";
import { sessionExpired } from "./db";

afterEach(() => {
  vi.unstubAllGlobals();
});

const respond = (status: number, body: unknown) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));

describe("suggestOpener", () => {
  it("успех — черновик; запрос с защитой от CSRF", async () => {
    respond(200, { draft: { first_line: "Увидел у вас выезд" } });
    const res = await suggestOpener("id-1");
    expect(res).toEqual({ data: { first_line: "Увидел у вас выезд" }, error: null });
    const [url, init] = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("/api/ai/opener");
    expect(init.headers).toMatchObject({ "x-webik": "1" });
    expect(JSON.parse(String(init.body))).toEqual({ leadId: "id-1" });
  });

  it("ошибка сервера — её текст", async () => {
    respond(422, { error: "Не получилось прочитать сайт" });
    expect(await suggestOpener("id")).toEqual({ data: null, error: "Не получилось прочитать сайт" });
  });

  it("401 — событие «сессия истекла» и текст из { error: { message } }", async () => {
    respond(401, { data: null, error: { message: "Сессия истекла — войдите снова" } });
    const expired = vi.fn();
    sessionExpired.addEventListener("expired", expired);
    expect(await suggestOpener("id")).toEqual({ data: null, error: "Сессия истекла — войдите снова" });
    expect(expired).toHaveBeenCalledOnce();
    sessionExpired.removeEventListener("expired", expired);
  });

  it("не JSON и нет сети — понятные тексты", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>502</html>", { status: 502 })));
    expect(await suggestOpener("id")).toEqual({ data: null, error: "Сервер ответил 502" });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    expect(await suggestOpener("id")).toEqual({ data: null, error: "Нет связи с сервером" });
  });
});

it("буква варианта → значение CRM", () => {
  expect(variantFromLetter("А")).toBe("А — заявки");
  expect(variantFromLetter("В")).toBe("В — счета");
  expect(variantFromLetter("Z")).toBe("");
});

it("рубли: две цифры после запятой, неразрывный пробел", () => {
  expect(formatRub(1.9)).toBe("1,90 ₽");
});
