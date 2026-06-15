import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

type Message = { id: number; from: "bot" | "user"; text: string };

const REPLIES = [
  "Отличный вопрос! Лендинг под ключ занимает у нас 7–10 дней.",
  "Да, мы делаем ботов и для Telegram, и для MAX.",
  "Стоимость зависит от задач — оставьте почту, пришлём смету за день.",
  "AI-агента можно обучить на ваших регламентах и базе знаний.",
];

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: "bot", text: "Привет! Я бот WebIK. Спросите что-нибудь о наших услугах 👋" },
  ]);
  const [value, setValue] = useState("");
  const [typing, setTyping] = useState(false);
  const replyIndex = useRef(0);
  const nextId = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);

  // Автопрокрутка ленты к последнему сообщению / индикатору печати
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = () => {
    const text = value.trim();
    if (!text || typing) return;
    setValue("");
    setMessages((m) => [...m, { id: nextId.current++, from: "user", text }]);
    setTyping(true);
    setTimeout(() => {
      const reply = REPLIES[replyIndex.current % REPLIES.length];
      replyIndex.current += 1;
      setMessages((m) => [...m, { id: nextId.current++, from: "bot", text: reply }]);
      setTyping(false);
    }, 1100);
  };

  return (
    <div className="flex flex-col h-[260px]">
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                msg.from === "bot"
                  ? "bg-white border border-black/[0.05] text-[#1a1a1a]/80 rounded-tl-md"
                  : "bg-[#1a1a1a] text-white ml-auto rounded-tr-md"
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
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Напишите боту..."
          className="w-full bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          aria-label="Отправить сообщение"
          className="bg-[#1a1a1a] text-white w-7 h-7 rounded-full relative shrink-0"
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
