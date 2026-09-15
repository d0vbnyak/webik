import { forwardRef, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import { MESSAGE_MAX_CHARS } from "../../../shared/chat";
import type { ChatMessage } from "./useChat";

type Props = {
  messages: ChatMessage[];
  typing: boolean;
  onSend: (text: string) => void;
  /** Размер текста: демо-окно компактнее виджета */
  size?: "sm" | "md";
  className?: string;
};

/** Лента сообщений с полем ввода. Логика диалога — в useChat. */
const ChatThread = forwardRef<HTMLInputElement, Props>(function ChatThread(
  { messages, typing, onSend, size = "sm", className = "" },
  inputRef,
) {
  const [value, setValue] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const text = size === "md" ? "text-sm" : "text-xs";

  // Автопрокрутка ленты к последнему сообщению / индикатору печати
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const submit = () => {
    if (!value.trim() || typing) return;
    onSend(value);
    setValue("");
  };

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div
        ref={listRef}
        // Скринридер должен озвучивать ответы бота, а клавиатура — листать ленту
        role="log"
        aria-live="polite"
        aria-label="Диалог с ботом"
        tabIndex={0}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 pr-1"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`max-w-[85%] rounded-2xl px-3 py-2 ${text} leading-relaxed whitespace-pre-wrap break-words ${
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
              aria-label="Бот печатает"
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
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && submit()}
          aria-label="Сообщение боту"
          maxLength={MESSAGE_MAX_CHARS}
          placeholder="Напишите боту..."
          // 16px на телефоне: иначе iOS увеличивает страницу при фокусе
          className={`w-full bg-transparent ${size === "md" ? "text-base sm:text-sm" : "text-xs"} text-zinc-900 placeholder:text-zinc-400 focus:outline-none`}
        />
        <button
          type="button"
          onClick={submit}
          disabled={typing || !value.trim()}
          aria-label="Отправить сообщение"
          className={`bg-[#1a1a1a] text-white ${size === "md" ? "w-9 h-9" : "w-7 h-7"} rounded-full relative shrink-0 transition-opacity disabled:opacity-30 disabled:pointer-events-none`}
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
});

export default ChatThread;
