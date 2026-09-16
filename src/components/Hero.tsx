import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { openAssistant } from "./assistant/events";

// Размер задан в em, а не в пикселях по брейкпоинтам: пропорция овала (0.97 : 0.53)
// и точка внутри держатся одинаковыми на любой ширине. На пиксельных значениях овал
// на узких экранах ужимался до круга и читался не ползунком, а конусом.
function EyePill() {
  return (
    <span className="relative w-[0.97em] h-[0.53em] inline-flex items-center justify-center align-middle mx-[0.16em] md:mx-[0.2em]">
      {/* Точка — всегда на месте */}
      <span className="w-[0.125em] h-[0.125em] rounded-full bg-[#1a1a1a]" />
      {/* Овал ездит по горизонтали и отталкивается от точки. CSS-анимация transform
          идёт в потоке композитора и не конкурирует с прокруткой за главный поток.
          При prefers-reduced-motion стоит на месте. Ключевые кадры — в index.css */}
      <span className="eye-pill absolute inset-0 border-[2px] border-[#1a1a1a] rounded-full" />
    </span>
  );
}

export default function Hero() {
  const [task, setTask] = useState("");

  // Задача уходит ассистенту: он уточнит детали и отправит заявку
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = task.trim();
    if (!text) return;
    openAssistant(text);
    setTask("");
  };

  return (
    <section className="relative min-h-[100svh] w-full flex flex-col items-center justify-start overflow-hidden bg-bg-base">
      {/* Контент */}
      <div className="max-w-7xl w-full mx-auto px-8 md:px-16 lg:px-20 relative z-10 grid grid-cols-12 gap-x-4 md:gap-x-8 pt-32 sm:pt-40 md:pt-44">
        <div className="col-span-12 md:col-span-10 md:col-start-2">
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="font-display font-medium tracking-tight text-[2rem] leading-[1.14] sm:text-5xl lg:text-6xl xl:text-[64px]"
          >
            <span className="text-[#1a1a1a]">WebIK создаёт </span>
            <span className="text-[#8e8e8e]">лендинги,</span>
            <br className="hidden sm:inline" />
            <span className="text-[#8e8e8e]"> ботов и AI-решения, которые</span>
            <br className="hidden sm:inline" />
            <span className="text-[#8e8e8e]">
              {" "}
              двигают <EyePill /> ваш бизнес.
            </span>
          </motion.h1>

          {/* Поле задачи — открывает ИИ-ассистента */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="mt-8 md:mt-12 max-w-[420px]"
          >
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-[6px] border border-black/[0.05] p-1 pl-4 flex items-center shadow-sm"
            >
              <input
                type="text"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                aria-label="Опишите вашу задачу"
                placeholder="Опишите вашу задачу..."
                className="w-full bg-transparent text-base sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Отправить ИИ-ассистенту"
                className="bg-[#1a1a1a] text-white w-9 h-9 rounded-full relative shrink-0"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="absolute inset-0 m-auto w-4 h-4"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </form>
            <p className="mt-3 pl-1 text-xs text-[#1a1a1a]/45">
              ИИ-ассистент уточнит детали и передаст заявку
            </p>
          </motion.div>
        </div>
      </div>

      {/* Якорь — переключатель языка, середина справа */}
      <div className="absolute right-3 md:right-6 top-[68%] sm:top-1/2 -translate-y-1/2 z-20">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Английская версия скоро"
          className="flex items-center gap-1.5 rounded-full bg-white/70 border border-black/[0.06] px-3.5 py-2 text-[11px] tracking-wide text-[#1a1a1a] shadow-sm cursor-not-allowed"
        >
          <span className="font-medium">ru</span>
          <span className="text-[#1a1a1a]/40">—</span>
          <span className="text-[#1a1a1a]/50">en</span>
        </button>
      </div>

      {/* Якорь — низ слева. Правый нижний угол занят кнопкой ассистента */}
      <div className="absolute bottom-5 left-5 md:left-8 z-20 text-[11px] tracking-wide text-[#1a1a1a]/70">
        2026 — AI-решения для бизнеса
      </div>
    </section>
  );
}
