import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type Parts = { days: number; hours: number; minutes: number; seconds: number };

const UNITS: { key: keyof Parts; label: string }[] = [
  { key: "days", label: "дней" },
  { key: "hours", label: "часов" },
  { key: "minutes", label: "минут" },
  { key: "seconds", label: "секунд" },
];

function diff(target: number): { parts: Parts; over: boolean } {
  const ms = Math.max(0, target - Date.now());
  const totalSec = Math.floor(ms / 1000);
  return {
    over: ms <= 0,
    parts: {
      days: Math.floor(totalSec / 86400),
      hours: Math.floor((totalSec % 86400) / 3600),
      minutes: Math.floor((totalSec % 3600) / 60),
      seconds: totalSec % 60,
    },
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function CountdownTimer() {
  // целевая дата: сейчас + 3 дня 7 часов (фиксируется на первом маунте)
  const [target] = useState(() => Date.now() + (3 * 24 + 7) * 60 * 60 * 1000);
  const [state, setState] = useState(() => diff(target));

  useEffect(() => {
    // если время уже вышло на маунте — интервал не нужен
    if (diff(target).over) return;
    const id = window.setInterval(() => {
      const next = diff(target);
      setState(next);
      // достигли нуля — останавливаем тик, чтобы не ре-рендерить вхолостую
      if (next.over) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <div className="font-display font-medium text-base text-[#1a1a1a]">
          до конца акции
        </div>
        <p className="mt-0.5 text-[11px] text-[#1a1a1a]/50">
          скидка 20% на запуск лендинга
        </p>
      </div>

      {state.over ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl bg-white border border-black/[0.05] shadow-sm px-6 py-4 font-display font-medium text-lg text-[#1a1a1a]"
        >
          время вышло ⏰
        </motion.div>
      ) : (
        <div className="grid w-full max-w-[300px] grid-cols-4 gap-1.5 sm:gap-2.5">
          {UNITS.map((u) => {
            const value = pad(state.parts[u.key]);
            return (
              <div key={u.key} className="flex flex-col items-center">
                <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-white border border-black/[0.05] shadow-sm">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={value}
                      initial={{ y: "-60%", opacity: 0 }}
                      animate={{ y: "0%", opacity: 1 }}
                      exit={{ y: "60%", opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="font-display font-medium text-xl sm:text-2xl text-[#1a1a1a]"
                    >
                      {value}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <span className="mt-1.5 text-[9px] sm:text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
                  {u.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
