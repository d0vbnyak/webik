import { useId, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

type Category = "сайты" | "боты" | "дизайн" | "seo";

type Product = {
  id: string;
  title: string;
  category: Category;
  price: number;
  color: string;
};

const PRODUCTS: Product[] = [
  { id: "p1", title: "лендинг", category: "сайты", price: 45000, color: "#1a1a1a" },
  { id: "p2", title: "корпоративный сайт", category: "сайты", price: 120000, color: "#2e2e2e" },
  { id: "p3", title: "интернет-магазин", category: "сайты", price: 180000, color: "#1a1a1a" },
  { id: "p4", title: "telegram-бот", category: "боты", price: 35000, color: "#8e8e8e" },
  { id: "p5", title: "чат-бот поддержки", category: "боты", price: 60000, color: "#6e6e6e" },
  { id: "p6", title: "ui-кит", category: "дизайн", price: 40000, color: "#9fff00" },
  { id: "p7", title: "редизайн", category: "дизайн", price: 90000, color: "#1a1a1a" },
  { id: "p8", title: "логотип + айдентика", category: "дизайн", price: 55000, color: "#8e8e8e" },
  { id: "p9", title: "базовое seo", category: "seo", price: 25000, color: "#2e2e2e" },
  { id: "p10", title: "seo под ключ", category: "seo", price: 80000, color: "#6e6e6e" },
];

const CATEGORIES: Category[] = ["сайты", "боты", "дизайн", "seo"];
const MIN_PRICE = 25000;
const MAX_PRICE = 180000;

export default function CatalogFilter() {
  const uid = useId();
  const reduce = useReducedMotion();
  const [active, setActive] = useState<Category[]>([]);
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);

  const toggle = (c: Category) =>
    setActive((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  const filtered = useMemo(
    () =>
      PRODUCTS.filter(
        (p) =>
          (active.length === 0 || active.includes(p.category)) &&
          p.price <= maxPrice,
      ),
    [active, maxPrice],
  );

  return (
    <div className="flex flex-col gap-3 min-h-[280px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const on = active.includes(c);
            return (
              <label
                key={c}
                className={`flex items-center gap-1.5 text-[11px] lowercase rounded-full px-2.5 py-1.5 border cursor-pointer transition-colors ring-brand-green has-[:focus-visible]:ring-2 ${
                  on
                    ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                    : "bg-white text-[#1a1a1a]/70 border-black/[0.08] hover:border-black/20"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(c)}
                  className="sr-only"
                />
                {on ? "✓" : "+"} {c}
              </label>
            );
          })}
        </div>
        <span className="text-[11px] text-[#1a1a1a]/55">
          найдено{" "}
          <span className="font-display font-medium text-[#1a1a1a]">
            {filtered.length}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <label
          htmlFor={`${uid}-price`}
          className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40 whitespace-nowrap"
        >
          цена до
        </label>
        <input
          id={`${uid}-price`}
          type="range"
          min={MIN_PRICE}
          max={MAX_PRICE}
          step={5000}
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="h-9 flex-1 cursor-pointer accent-[#1a1a1a]"
        />
        <span className="font-display text-xs text-[#1a1a1a] tabular-nums w-[88px] text-right">
          {maxPrice.toLocaleString("ru-RU")} ₽
        </span>
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: reduce ? 0 : 0.22 }}
                className="bg-white rounded-xl border border-black/[0.05] shadow-sm p-2.5 flex items-center gap-2.5"
              >
                <span
                  className="w-8 h-8 rounded-lg shrink-0"
                  style={{ backgroundColor: p.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="text-[12px] text-[#1a1a1a] truncate">
                    {p.title}
                  </div>
                  <div className="font-display text-[11px] text-[#1a1a1a]/55">
                    {p.price.toLocaleString("ru-RU")} ₽
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {filtered.length === 0 && (
          <div className="h-full flex items-center justify-center text-[11px] text-[#1a1a1a]/40 lowercase">
            ничего не найдено — ослабьте фильтры
          </div>
        )}
      </div>
    </div>
  );
}
