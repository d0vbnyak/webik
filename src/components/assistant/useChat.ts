import { useCallback, useEffect, useRef, useState } from "react";

export type ChatMessage = { id: number; from: "bot" | "user"; text: string; error?: boolean };

/** Адрес обработчика чата (server/chat.ts). */
const CHAT_ENDPOINT = "/api/chat";

/**
 * Диалог с ботом: лента сообщений, индикатор печати и отправка.
 * Общий для демо-чата на «Возможностях» и виджета ассистента.
 *
 * `onUnavailable` вызывается, когда сервер ответил 503 — чат выключен
 * (в проде, пока нет российской модели). Виджет в этом случае показывает форму.
 */
export function useChat(greeting: string, opts: { onUnavailable?: () => void } = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 0, from: "bot", text: greeting }]);
  const [typing, setTyping] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const nextId = useRef(1);
  const abortRef = useRef<AbortController | null>(null);
  // Историю диалога помнит сервер; мы носим только идентификатор сессии.
  const sessionId = useRef<string | null>(null);
  const typingRef = useRef(false);
  const onUnavailable = useRef(opts.onUnavailable);
  onUnavailable.current = opts.onUnavailable;

  // Обрываем висящий запрос при размонтировании
  useEffect(() => () => abortRef.current?.abort(), []);

  const push = (from: ChatMessage["from"], text: string, error?: boolean) =>
    setMessages((m) => [...m, { id: nextId.current++, from, text, error }]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    // Ref, а не state: два быстрых вызова подряд видят одно и то же старое значение state
    if (!text || typingRef.current) return false;

    push("user", text);
    typingRef.current = true;
    setTyping(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ sessionId: sessionId.current, message: text }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const reason =
          (data && typeof data.error === "string" && data.error) ||
          "Не получилось связаться с ботом. Попробуйте ещё раз.";
        push("bot", reason, true);
        if (response.status === 503) onUnavailable.current?.();
        return true;
      }
      if (typeof data?.reply !== "string") {
        push("bot", "Ответ пришёл в неожиданном виде. Попробуйте ещё раз.", true);
        return true;
      }
      if (typeof data.sessionId === "string") sessionId.current = data.sessionId;
      if (data.orderSent === true) setOrderSent(true);
      push("bot", data.reply);
    } catch (e) {
      if ((e as Error).name === "AbortError") return true;
      push("bot", "Сеть недоступна — ответ не дошёл. Попробуйте ещё раз.", true);
    } finally {
      abortRef.current = null;
      typingRef.current = false;
      setTyping(false);
    }
    return true;
  }, []);

  return { messages, typing, orderSent, send };
}
