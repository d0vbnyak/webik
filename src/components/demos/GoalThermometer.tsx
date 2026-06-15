import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const GOAL = 100_000;
const START = 38_500;
const TICKS = [0, 25, 50, 75, 100];

const fmt = (n: number) => n.toLocaleString("ru-RU");

export default function GoalThermometer() {
  const [raised, setRaised] = useState(START);

  const capped = Math.min(raised, GOAL);
  const pct = Math.round((capped / GOAL) * 100);
  const reached = raised >= GOAL;

  const support = () => {
    if (reached) return;
    // случайная сумма поддержки 2 000–9 000 ₽
    const amount = 2000 + Math.floor(Math.random() * 7000);
    setRaised((r) => Math.min(GOAL, r + amount));
  };

  return (
    <div className="flex items-center gap-7">
      {/* Вертикальная шкала-термометр */}
      <div
        className="relative flex h-[210px] items-end shrink-0"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`собрано ${pct}% от цели`}
      >
        {/* колба */}
        <div className="relative h-[180px] w-9 rounded-full bg-white border border-black/[0.05] shadow-sm overflow-hidden">
          {/* заливка: scaleY от низа вместо анимации height (без reflow) */}
          <motion.div
            className="absolute bottom-0 left-0 h-full w-full origin-bottom bg-brand-green"
            animate={{ scaleY: pct / 100 }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          />
        </div>
        {/* «шарик» снизу */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-7 w-7 rounded-full bg-brand-green border-2 border-white shadow-sm" />

        {/* отметки-деления */}
        <div className="ml-2 flex h-[180px] flex-col-reverse justify-between py-1">
          {TICKS.map((t) => (
            <span
              key={t}
              className="text-[9px] lowercase tracking-wide text-[#1a1a1a]/40 leading-none"
            >
              {t}%
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3">
        <div>
          <div className="font-display font-medium text-base text-[#1a1a1a]">
            термометр цели
          </div>
          <p className="mt-0.5 text-[11px] text-[#1a1a1a]/50">
            сбор на запуск нового сервиса
          </p>
        </div>

        <div className="rounded-xl bg-white border border-black/[0.05] shadow-sm p-3">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={capped}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="font-display font-medium text-xl text-[#1a1a1a]"
            >
              {fmt(capped)} ₽
            </motion.div>
          </AnimatePresence>
          <div className="mt-0.5 text-[11px] text-[#1a1a1a]/50">
            из {fmt(GOAL)} ₽ · {pct}%
          </div>
        </div>

        {reached ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm lowercase font-medium text-[#1a1a1a]"
          >
            🎉 цель собрана!
          </motion.div>
        ) : (
          <button
            type="button"
            onClick={support}
            className="rounded-full bg-[#1a1a1a] px-5 py-2.5 text-sm lowercase text-white transition-opacity hover:opacity-90"
          >
            + поддержать
          </button>
        )}
      </div>
    </div>
  );
}
