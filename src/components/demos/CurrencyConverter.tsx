import { useId, useMemo, useState } from "react";
import { motion } from "motion/react";

type Code = "RUB" | "USD" | "EUR" | "CNY";

// фиксированные демо-курсы: сколько рублей за 1 единицу валюты
const RATES: Record<Code, number> = {
  RUB: 1,
  USD: 92.4,
  EUR: 99.8,
  CNY: 12.7,
};

const CODES: Code[] = ["RUB", "USD", "EUR", "CNY"];
const SYMBOL: Record<Code, string> = { RUB: "₽", USD: "$", EUR: "€", CNY: "¥" };

/**
 * Конвертер валют на фиксированных демо-курсах.
 * Мгновенный пересчёт + кнопка «поменять местами» с поворотом.
 */
export default function CurrencyConverter() {
  const uid = useId();
  const [amount, setAmount] = useState(1000);
  const [from, setFrom] = useState<Code>("RUB");
  const [to, setTo] = useState<Code>("USD");
  // накопительный угол поворота — крутим по факту нажатия, а не по значению from
  const [spin, setSpin] = useState(0);

  const result = useMemo(() => {
    const inRub = amount * RATES[from];
    return inRub / RATES[to];
  }, [amount, from, to]);

  const pairRate = useMemo(() => RATES[from] / RATES[to], [from, to]);

  const swap = () => {
    setFrom(to);
    setTo(from);
    setSpin((s) => s + 180);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label
            htmlFor={`${uid}-amount`}
            className="block text-[10px] lowercase tracking-wide text-[#1a1a1a]/40 mb-1"
          >
            сумма
          </label>
          <input
            id={`${uid}-amount`}
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
            className="h-[50px] w-full bg-white rounded-xl border border-black/[0.08] shadow-sm px-3.5 font-display font-medium text-lg text-[#1a1a1a] outline-none focus:border-black/25 transition-colors"
          />
        </div>
        <CurrencyPicker
          idBase={`${uid}-from`}
          value={from}
          exclude={to}
          onChange={setFrom}
        />
      </div>

      <div className="flex justify-center">
        <motion.button
          type="button"
          onClick={swap}
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: spin }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          aria-label="Поменять валюты местами"
          className="w-8 h-8 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-sm shadow-sm hover:opacity-90"
        >
          ⇅
        </motion.button>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1 bg-white rounded-xl border border-black/[0.05] shadow-sm px-3.5 py-2.5">
          <div className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40 mb-0.5">
            получите
          </div>
          <div className="font-display font-medium text-lg text-[#1a1a1a]">
            {result.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}{" "}
            <span className="text-[#8e8e8e]">{SYMBOL[to]}</span>
          </div>
        </div>
        <CurrencyPicker
          idBase={`${uid}-to`}
          value={to}
          exclude={from}
          onChange={setTo}
        />
      </div>

      <div className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40 text-center">
        курс: 1 {from} = {pairRate.toLocaleString("ru-RU", { maximumFractionDigits: 4 })}{" "}
        {to} · демо-данные
      </div>
    </div>
  );
}

function CurrencyPicker({
  idBase,
  value,
  exclude,
  onChange,
}: {
  idBase: string;
  value: Code;
  exclude: Code;
  onChange: (c: Code) => void;
}) {
  return (
    <div className="flex flex-col gap-1 shrink-0">
      <label htmlFor={idBase} className="sr-only">
        выбор валюты
      </label>
      <select
        id={idBase}
        value={value}
        onChange={(e) => onChange(e.target.value as Code)}
        className="h-[50px] bg-white rounded-xl border border-black/[0.08] shadow-sm px-2.5 text-xs font-medium text-[#1a1a1a] outline-none focus:border-black/25 transition-colors cursor-pointer"
      >
        {CODES.map((c) => (
          <option key={c} value={c} disabled={c === exclude}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
