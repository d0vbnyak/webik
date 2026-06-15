import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const OPTIONS = [
  { id: "design", label: "уникальный дизайн", price: 30000 },
  { id: "seo", label: "базовое SEO", price: 15000 },
  { id: "bot", label: "telegram-бот", price: 25000 },
] as const;

export default function PriceCalculator() {
  const [pages, setPages] = useState(5);
  const [selected, setSelected] = useState<string[]>(["design"]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const price =
    20000 +
    pages * 4000 +
    OPTIONS.filter((o) => selected.includes(o.id)).reduce((sum, o) => sum + o.price, 0);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex justify-between text-xs text-[#1a1a1a]/60 mb-2">
          <span>страниц на сайте</span>
          <span className="font-medium text-[#1a1a1a]">{pages}</span>
        </div>
        <input
          type="range"
          min={1}
          max={20}
          value={pages}
          onChange={(e) => setPages(Number(e.target.value))}
          className="w-full accent-[#1a1a1a]"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const active = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={`inline-flex min-h-[40px] items-center text-xs lowercase rounded-full px-3.5 py-2.5 border transition-colors ${
                active
                  ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                  : "bg-white text-[#1a1a1a]/70 border-black/[0.08] hover:border-black/20"
              }`}
            >
              {active ? "✓ " : "+ "}
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-black/[0.05] p-4 flex items-center justify-between">
        <span className="text-xs text-[#1a1a1a]/55">примерная стоимость</span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={price}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="font-display font-medium text-xl text-[#1a1a1a]"
          >
            {price.toLocaleString("ru-RU")} ₽
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
