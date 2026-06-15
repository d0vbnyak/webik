import { useId, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

/**
 * ROI-калькулятор. Слайдеры: вложения и доход в месяц.
 * Считает срок окупаемости (мес.) и ROI за год.
 * Горизонтальная полоса показывает рост прибыли относительно вложений.
 */
export default function RoiCalculator() {
  const uid = useId();
  const [invest, setInvest] = useState(150_000);
  const [income, setIncome] = useState(40_000);

  const { months, roi, fill } = useMemo(() => {
    const payback = income > 0 ? invest / income : Infinity;
    const yearProfit = income * 12 - invest;
    const roiPct = invest > 0 ? (yearProfit / invest) * 100 : 0;
    // доля прибыли за год относительно вложений, нормируем к 100%
    const ratio = invest > 0 ? Math.min((income * 12) / invest, 3) / 3 : 0;
    return {
      months: payback,
      roi: Math.round(roiPct),
      fill: ratio,
    };
  }, [invest, income]);

  const monthsLabel = Number.isFinite(months) ? months.toFixed(1) : "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="flex justify-between text-xs text-[#1a1a1a]/60 mb-1.5">
            <label htmlFor={`${uid}-invest`}>вложения</label>
            <span className="font-medium text-[#1a1a1a]">
              {invest.toLocaleString("ru-RU")} ₽
            </span>
          </div>
          <input
            id={`${uid}-invest`}
            type="range"
            min={50_000}
            max={1_000_000}
            step={10_000}
            value={invest}
            onChange={(e) => setInvest(Number(e.target.value))}
            className="w-full accent-[#1a1a1a]"
          />
        </div>
        <div>
          <div className="flex justify-between text-xs text-[#1a1a1a]/60 mb-1.5">
            <label htmlFor={`${uid}-income`}>доход / мес</label>
            <span className="font-medium text-[#1a1a1a]">
              {income.toLocaleString("ru-RU")} ₽
            </span>
          </div>
          <input
            id={`${uid}-income`}
            type="range"
            min={5_000}
            max={300_000}
            step={5_000}
            value={income}
            onChange={(e) => setIncome(Number(e.target.value))}
            className="w-full accent-[#1a1a1a]"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-black/[0.05] shadow-sm p-4 flex items-end justify-between">
        <div>
          <div className="text-xs text-[#1a1a1a]/55 mb-1">окупится за</div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={monthsLabel}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="font-display font-medium text-2xl text-[#1a1a1a]"
            >
              {monthsLabel} <span className="text-base text-[#8e8e8e]">мес.</span>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="text-right">
          <div className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
            roi за год
          </div>
          <div
            className={`font-display font-medium text-lg ${
              roi >= 0 ? "text-[#1a1a1a]" : "text-[#1a1a1a]/50"
            }`}
          >
            {roi >= 0 ? "+" : ""}
            {roi}%
          </div>
        </div>
      </div>

      {/* полоса прибыли */}
      <div>
        <div className="h-2.5 w-full rounded-full bg-[#1a1a1a]/[0.06] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-brand-green"
            initial={false}
            animate={{ width: `${Math.max(fill * 100, 4)}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
        <div className="mt-1.5 text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
          прибыль за год относительно вложений
        </div>
      </div>
    </div>
  );
}
