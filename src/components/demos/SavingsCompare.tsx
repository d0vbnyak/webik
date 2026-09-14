import { useId, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

/**
 * «Сколько сэкономите»: два сценария рядом —
 * «менеджер отвечает сам» vs «бот поддержки WebIK».
 * Допущение демо: повторяющиеся вопросы съедают время менеджера на 30 000 ₽ в месяц.
 * Разница (экономия) подсвечена brand-green и анимируется со слайдером.
 */
export default function SavingsCompare() {
  const uid = useId();
  const [months, setMonths] = useState(12);

  const { diy, webik, saving } = useMemo(() => {
    // вручную: время менеджера на однотипные ответы каждый месяц
    const diyCost = months * 30_000;
    // webik: бот поддержки по прайсу + сопровождение
    const webikCost = 120_000 + months * 10_000;
    return {
      diy: Math.round(diyCost),
      webik: Math.round(webikCost),
      saving: Math.round(diyCost - webikCost),
    };
  }, [months]);

  const max = Math.max(diy, webik, 1);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-xs text-[#1a1a1a]/60 mb-1.5">
          <label htmlFor={`${uid}-months`}>горизонт</label>
          <span className="font-medium text-[#1a1a1a]">{months} мес.</span>
        </div>
        <input
          id={`${uid}-months`}
          type="range"
          min={3}
          max={36}
          step={1}
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="w-full accent-[#1a1a1a]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Scenario
          label="менеджер отвечает сам"
          amount={diy}
          ratio={diy / max}
          tone="muted"
        />
        <Scenario label="бот webik" amount={webik} ratio={webik / max} tone="ink" />
      </div>

      <div className="bg-white rounded-xl border border-black/[0.05] shadow-sm p-4 flex items-center justify-between">
        <span className="text-xs text-[#1a1a1a]/55">
          {saving >= 0 ? "экономия" : "переплата"}
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={saving}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className={`font-display font-medium text-xl px-2 rounded-md ${
              saving >= 0
                ? "bg-brand-green text-[#1a1a1a]"
                : "text-[#1a1a1a]/60"
            }`}
          >
            {saving >= 0 ? "" : "−"}
            {Math.abs(saving).toLocaleString("ru-RU")} ₽
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Scenario({
  label,
  amount,
  ratio,
  tone,
}: {
  label: string;
  amount: number;
  ratio: number;
  tone: "muted" | "ink";
}) {
  return (
    <div className="bg-white rounded-xl border border-black/[0.05] shadow-sm p-3.5">
      <div className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40 mb-1.5 truncate">
        {label}
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={amount}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="font-display font-medium text-lg text-[#1a1a1a]"
        >
          {amount.toLocaleString("ru-RU")} ₽
        </motion.div>
      </AnimatePresence>
      <div className="mt-2 h-1.5 w-full rounded-full bg-[#1a1a1a]/[0.06] overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            tone === "ink" ? "bg-[#1a1a1a]" : "bg-[#8e8e8e]"
          }`}
          initial={false}
          animate={{ width: `${Math.max(ratio * 100, 4)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}
