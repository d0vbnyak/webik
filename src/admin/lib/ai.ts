// ИИ в админке: запросы к серверу (server/ai). Ключ модели в браузер не попадает.
import { API_HEADERS, sessionExpired } from "./db";
import { VARIANTS } from "./crm";

/** Черновик первой строки письма — как отдаёт POST /api/ai/opener. */
export type OpenerDraft = {
  business: string;
  fit: "да" | "нет" | "неясно";
  variant: "А" | "Б" | "В";
  hook: string;
  quote: string;
  first_line: string;
  quoteFound: boolean;
  warnings: string[];
  source: "site" | "search";
  pages: string[];
  model: string;
  costRub: number;
};

export type AiResult<T> = { data: T; error: null } | { data: null; error: string };

export async function suggestOpener(leadId: string): Promise<AiResult<OpenerDraft>> {
  try {
    const res = await fetch("/api/ai/opener", {
      method: "POST",
      credentials: "same-origin",
      headers: API_HEADERS,
      body: JSON.stringify({ leadId }),
    });
    if (res.status === 401) sessionExpired.dispatchEvent(new Event("expired"));
    const body = (await res.json().catch(() => null)) as { draft?: OpenerDraft; error?: unknown } | null;
    if (res.ok && body?.draft) return { data: body.draft, error: null };
    // 401 от общего обработчика приходит как { error: { message } }
    const err = body?.error;
    const message = typeof err === "string" ? err : (err as { message?: string } | undefined)?.message;
    return { data: null, error: message ?? `Сервер ответил ${res.status}` };
  } catch {
    return { data: null, error: "Нет связи с сервером" };
  }
}

/** Буква варианта от ИИ → значение из списка CRM («А — заявки»). */
export function variantFromLetter(letter: string): string {
  return VARIANTS.find((v) => v.startsWith(letter)) ?? "";
}

/** 1.9 → «1,90 ₽» */
export function formatRub(value: number): string {
  // Неразрывный пробел: «₽» не уезжает на новую строку
  return `${value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}
