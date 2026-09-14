import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import { MESSAGE_MAX_CHARS } from "../../../shared/chat";

type Message = { id: number; from: "bot" | "user"; text: string; error?: boolean };

/** Адрес обработчика. В проде меняется на URL Supabase Edge Function. */
const CHAT_ENDPOINT = "/api/chat";

const GREETING = "Привет! Я бот WebIK. Спросите что-нибудь о наших услугах 👋";

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: "bot", text: GREETING },
  ]);
  const [value, setValue] = useState("");
  const [typing, setTyping] = useState(false);
  const nextId = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Историю диалога помнит сервер; мы носим только идентификатор сессии.
  const sessionId = useRef<string | null>(null);

  // Автопрокрутка ленты к последнему сообщению / индикатору печати
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  // Обрываем висящий запрос при размонтировании
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const send = async () => {
    const text = value.trim();
    if (!text || typing) return;

    const outgoing: Message = { id: nextId.current++, from: "user", text };
    setMessages((m) => [...m, outgoing]);
    setValue("");
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
        setMessages((m) => [
          ...m,
          { id: nextId.current++, from: "bot", text: reason, error: true },
        ]);
        return;
      }

      if (typeof data?.reply !== "string") {
        setMessages((m) => [
          ...m,
          {
            id: nextId.current++,
            from: "bot",
            text: "Ответ пришёл в неожиданном виде. Попробуйте ещё раз.",
            error: true,
          },
        ]);
        return;
      }

      if (typeof data.sessionId === "string") sessionId.current = data.sessionId;

      setMessages((m) => [
        ...m,
        { id: nextId.current++, from: "bot", text: data.reply },
      ]);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setMessages((m) => [
        ...m,
        {
          id: nextId.current++,
          from: "bot",
          text: "Сеть недоступна — ответ не дошёл. Попробуйте ещё раз.",
          error: true,
        },
      ]);
    } finally {
      abortRef.current = null;
      setTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[260px]">
      <div
        ref={listRef}
        // Скринридер должен озвучивать ответы бота, а клавиатура — листать ленту
        role="log"
        aria-live="polite"
        aria-label="Диалог с ботом"
        tabIndex={0}
        className="flex-1 overflow-y-auto space-y-2 pr-1"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.from === "user"
                  ? "bg-[#1a1a1a] text-white ml-auto rounded-tr-md"
                  : msg.error
                    ? "bg-red-50 border border-red-200 text-red-900/80 rounded-tl-md"
                    : "bg-white border border-black/[0.05] text-[#1a1a1a]/80 rounded-tl-md"
              }`}
            >
              {msg.text}
            </motion.div>
          ))}
          {typing && (
            <motion.div
              key="typing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-1 w-fit rounded-2xl rounded-tl-md bg-white border border-black/[0.05] px-3 py-2.5"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1.5 h-1.5 rounded-full bg-[#1a1a1a]/50"
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-3 bg-white rounded-[6px] border border-black/[0.05] p-1 pl-3 flex items-center shadow-sm">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && send()}
          disabled={typing}
          aria-label="Сообщение боту"
          maxLength={MESSAGE_MAX_CHARS}
          placeholder="Напишите боту..."
          className="w-full bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={send}
          disabled={typing || !value.trim()}
          aria-label="Отправить сообщение"
          className="bg-[#1a1a1a] text-white w-7 h-7 rounded-full relative shrink-0 transition-opacity disabled:opacity-30 disabled:pointer-events-none"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute inset-0 m-auto w-3.5 h-3.5"
            aria-hidden="true"
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
