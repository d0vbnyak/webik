import { useId, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

/**
 * Ипотечный калькулятор. Три слайдера: сумма, ставка, срок.
 * Аннуитетный платёж + переплата считаются мгновенно.
 * Мини-график показывает убывающий остаток долга по годам.
 */
export default function MortgageCalc() {
  const uid = useId();
  const [amount, setAmount] = useState(4_000_000);
  const [rate, setRate] = useState(18);
  const [years, setYears] = useState(15);

  const { payment, overpay, bars } = useMemo(() => {
    const months = years * 12;
    const i = rate / 100 / 12;
    // аннуитетный платёж
    const monthly =
      i === 0 ? amount / months : (amount * i) / (1 - Math.pow(1 + i, -months));
    const total = monthly * months;

    // остаток долга по годам для мини-графика
    const points = 12;
    let balance = amount;
    const yearlyBalances: number[] = [balance];
    for (let m = 1; m <= months; m++) {
      const interest = balance * i;
      balance = balance - (monthly - interest);
      if (m % Math.ceil(months / points) === 0) yearlyBalances.push(Math.max(balance, 0));
    }
    const max = yearlyBalances[0] || 1;
    return {
      payment: Math.round(monthly),
      overpay: Math.round(total - amount),
      bars: yearlyBalances.map((b) => Math.max(b, 0) / max),
    };
  }, [amount, rate, years]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <Slider
          id={`${uid}-amount`}
          label="сумма кредита"
          value={`${amount.toLocaleString("ru-RU")} ₽`}
          min={500_000}
          max={15_000_000}
          step={100_000}
          raw={amount}
          onChange={setAmount}
        />
        <div className="grid grid-cols-2 gap-3">
          <Slider
            id={`${uid}-rate`}
            label="ставка"
            value={`${rate}%`}
            min={5}
            max={30}
            step={0.5}
            raw={rate}
            onChange={setRate}
          />
          <Slider
            id={`${uid}-years`}
            label="срок"
            value={`${years} лет`}
            min={1}
            max={30}
            step={1}
            raw={years}
            onChange={setYears}
          />
        </div>
      </div>

      <div className="flex items-stretch gap-3">
        <div className="flex-1 bg-white rounded-xl border border-black/[0.05] shadow-sm p-3.5">
          <div className="text-xs text-[#1a1a1a]/55 mb-1">платёж в месяц</div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={payment}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="font-display font-medium text-xl text-[#1a1a1a]"
            >
              {payment.toLocaleString("ru-RU")} ₽
            </motion.div>
          </AnimatePresence>
        </div>

        {/* мини-график убывающего остатка */}
        <div className="flex items-end gap-1 bg-white rounded-xl border border-black/[0.05] shadow-sm px-3 py-2 h-[58px]">
          {bars.map((h, idx) => (
            <motion.span
              key={idx}
              className="w-1.5 h-full rounded-full bg-[#1a1a1a]/15 origin-bottom"
              initial={false}
              animate={{ scaleY: Math.max(h, 0.06) }}
              transition={{ duration: 0.3, delay: idx * 0.01 }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
          переплата за весь срок
        </span>
        <span className="font-display font-medium text-[#1a1a1a]/70">
          {overpay.toLocaleString("ru-RU")} ₽
        </span>
      </div>
    </div>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  raw,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  raw: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-[#1a1a1a]/60 mb-1.5">
        <label htmlFor={id}>{label}</label>
        <span className="font-medium text-[#1a1a1a]">{value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={raw}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#1a1a1a]"
      />
    </div>
  );
}
