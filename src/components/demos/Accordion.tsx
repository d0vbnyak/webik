import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const ITEMS = [
  {
    q: "Сколько стоит лендинг или бот?",
    a: "Лендинг — от 65 000 ₽, AI-бот поддержки — от 120 000 ₽. Точную смету готовим за один день после брифа.",
  },
  {
    q: "Какие сроки разработки?",
    a: "Лендинг запускаем примерно за неделю, AI-агента — примерно за месяц. Сроки фиксируем в договоре.",
  },
  {
    q: "Что нужно от меня?",
    a: "Только 30 минут на бриф. Тексты, фото и структуру мы берём на себя — включая AI-генерацию контента.",
  },
];

export default function Accordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {ITEMS.map((item, i) => {
        const open = openIndex === i;
        return (
          <div
            key={item.q}
            className="bg-white rounded-xl border border-black/[0.05] overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <span className="text-sm font-medium text-[#1a1a1a]">{item.q}</span>
              <motion.span
                animate={{ rotate: open ? 45 : 0 }}
                transition={{ duration: 0.25 }}
                className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-sm transition-colors ${
                  open ? "bg-brand-green text-[#1a1a1a]" : "bg-bg-base text-[#1a1a1a]/60"
                }`}
                aria-hidden="true"
              >
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <p className="px-4 pb-4 text-xs leading-relaxed text-[#1a1a1a]/60">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
