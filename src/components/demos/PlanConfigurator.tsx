import { useId, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const PLANS = [
  { id: "start", label: "старт", price: 25000 },
  { id: "pro", label: "про", price: 60000 },
  { id: "max", label: "макс", price: 120000 },
] as const;

const ADDONS = [
  { id: "support", label: "поддержка 24/7", price: 12000 },
  { id: "bot", label: "ai-бот на сайте", price: 18000 },
  { id: "analytics", label: "сквозная аналитика", price: 9000 },
  { id: "ab", label: "a/b тесты", price: 7000 },
] as const;

type PlanId = (typeof PLANS)[number]["id"];

/**
 * Конфигуратор тарифа: базовый план (пилюли) + тумблеры-опции.
 * Итоговая цена анимируется через AnimatePresence.
 */
export default function PlanConfigurator() {
  const uid = useId();
  const [plan, setPlan] = useState<PlanId>("pro");
  const [addons, setAddons] = useState<string[]>(["support"]);

  const toggle = (id: string) =>
    setAddons((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const base = PLANS.find((p) => p.id === plan)!.price;
  const extras = ADDONS.filter((a) => addons.includes(a.id)).reduce(
    (sum, a) => sum + a.price,
    0,
  );
  const total = base + extras;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {PLANS.map((p) => {
          const active = p.id === plan;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlan(p.id)}
              aria-pressed={active}
              className={`flex-1 rounded-full px-3.5 py-2 text-xs lowercase border transition-colors ${
                active
                  ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                  : "bg-white text-[#1a1a1a]/70 border-black/[0.08] hover:border-black/20"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {ADDONS.map((a) => {
          const on = addons.includes(a.id);
          const switchId = `${uid}-${a.id}`;
          return (
            <button
              key={a.id}
              type="button"
              id={switchId}
              role="switch"
              aria-checked={on}
              onClick={() => toggle(a.id)}
              className="w-full flex items-center justify-between gap-3 group"
            >
              <span className="flex items-center gap-2.5">
                <span
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                    on ? "bg-brand-green" : "bg-[#1a1a1a]/15"
                  }`}
                >
                  <motion.span
                    initial={false}
                    animate={{ x: on ? 16 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                  />
                </span>
                <span
                  className={`text-xs transition-colors ${
                    on ? "text-[#1a1a1a]" : "text-[#1a1a1a]/55"
                  }`}
                >
                  {a.label}
                </span>
              </span>
              <span className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
                +{a.price.toLocaleString("ru-RU")} ₽
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-black/[0.05] shadow-sm p-4 flex items-center justify-between">
        <span className="text-xs text-[#1a1a1a]/55">в месяц</span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={total}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="font-display font-medium text-xl text-[#1a1a1a]"
          >
            {total.toLocaleString("ru-RU")} ₽
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
