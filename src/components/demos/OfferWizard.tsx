import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Choice = { id: string; label: string; price: number };

const SOLUTIONS: Choice[] = [
  { id: "landing", label: "лендинг", price: 65000 },
  { id: "bot", label: "ai-бот", price: 120000 },
  { id: "agent", label: "прототип агента", price: 80000 },
];

const MODULES: Choice[] = [
  { id: "1c", label: "интеграция с 1с", price: 30000 },
  { id: "crm", label: "интеграция с crm", price: 25000 },
  { id: "training", label: "обучение сотрудников", price: 20000 },
  { id: "multi", label: "две языковые версии", price: 18000 },
];

const URGENCY: Choice[] = [
  { id: "flex", label: "без спешки", price: 0 },
  { id: "month", label: "за месяц", price: 20000 },
  { id: "asap", label: "срочно", price: 50000 },
];

const STEP_TITLES = ["решение", "модули", "срочность"];

/** Анимированный счётчик итоговой суммы. */
function AnimatedTotal({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const from = display;
    const start = performance.now();
    const dur = 500;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);

  return (
    <span className="font-display font-medium text-2xl text-[#1a1a1a] tabular-nums">
      {display.toLocaleString("ru-RU")} ₽
    </span>
  );
}

/**
 * Визард «соберите своё предложение»: тип → модули → срочность → смета.
 * Эмуляция: цены условные, итог считается локально, без отправки.
 */
export default function OfferWizard() {
  const uid = useId();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [solution, setSolution] = useState<string>("landing");
  const [modules, setModules] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<string>("flex");
  const [dir, setDir] = useState(1);

  const TOTAL_STEPS = 3;
  const done = step >= TOTAL_STEPS;

  const solutionChoice = SOLUTIONS.find((s) => s.id === solution)!;
  const moduleChoices = MODULES.filter((m) => modules.includes(m.id));
  const urgencyChoice = URGENCY.find((u) => u.id === urgency)!;

  const total =
    solutionChoice.price +
    moduleChoices.reduce((sum, m) => sum + m.price, 0) +
    urgencyChoice.price;

  const lineItems: Choice[] = [
    solutionChoice,
    ...moduleChoices,
    ...(urgencyChoice.price > 0 ? [urgencyChoice] : []),
  ];

  const toggleModule = (id: string) =>
    setModules((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const go = (delta: number) => {
    setDir(delta);
    setStep((s) => Math.max(0, Math.min(TOTAL_STEPS, s + delta)));
  };

  const reset = () => {
    setSolution("landing");
    setModules([]);
    setUrgency("flex");
    setDir(-1);
    setStep(0);
  };

  const slide = reduce ? 0 : 36;

  const renderPills = (
    list: Choice[],
    selected: string | string[],
    onPick: (id: string) => void,
    multi: boolean,
  ) => (
    <div className="flex flex-wrap gap-2">
      {list.map((c) => {
        const active = Array.isArray(selected)
          ? selected.includes(c.id)
          : selected === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            aria-pressed={active}
            role={multi ? "checkbox" : undefined}
            aria-checked={multi ? active : undefined}
            className={`text-xs lowercase rounded-full px-3.5 py-2 border transition-colors ${
              active
                ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                : "bg-white text-[#1a1a1a]/70 border-black/[0.08] hover:border-black/20"
            }`}
          >
            {multi ? (active ? "✓ " : "+ ") : ""}
            {c.label}
            {c.price > 0 && (
              <span className={active ? "text-white/55" : "text-[#1a1a1a]/35"}>
                {" "}
                · {c.price.toLocaleString("ru-RU")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="w-full max-w-[460px] mx-auto space-y-4">
      {/* прогресс */}
      <div className="flex items-center gap-2">
        {STEP_TITLES.map((title, i) => {
          const reached = i <= step;
          return (
            <span key={title} className="flex items-center gap-2 flex-1">
              <span
                className={`grid place-items-center w-5 h-5 rounded-full text-[10px] shrink-0 transition-colors ${
                  reached ? "bg-[#1a1a1a] text-white" : "bg-[#1a1a1a]/10 text-[#1a1a1a]/40"
                }`}
              >
                {step > i || done ? "✓" : i + 1}
              </span>
              {i < STEP_TITLES.length - 1 && (
                <span className="h-px flex-1 bg-[#1a1a1a]/10 overflow-hidden">
                  <motion.span
                    className="block h-full bg-brand-green"
                    initial={false}
                    animate={{ width: step > i ? "100%" : "0%" }}
                    transition={{ duration: 0.3 }}
                  />
                </span>
              )}
            </span>
          );
        })}
      </div>

      <div className="relative grid min-h-[170px] overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          {done ? (
            <motion.div
              key="summary"
              initial={{ opacity: 0, x: slide }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -slide }}
              transition={{ duration: 0.3 }}
              className="col-start-1 row-start-1 flex flex-col"
            >
              <div className="flex-1 bg-white rounded-xl border border-black/[0.05] shadow-sm p-4 overflow-y-auto">
                <div className="space-y-1.5">
                  {lineItems.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-[#1a1a1a]/55 lowercase">{c.label}</span>
                      <span className="text-[#1a1a1a] tabular-nums">
                        {c.price.toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-black/[0.06] flex items-center justify-between">
                  <span className="text-xs lowercase text-[#1a1a1a]/55">итого</span>
                  <AnimatedTotal value={total} />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * slide }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -slide }}
              transition={{ duration: 0.3 }}
              className="col-start-1 row-start-1 flex flex-col"
            >
              <p
                id={`${uid}-step-${step}`}
                className="font-display font-medium text-[#1a1a1a]"
              >
                {STEP_TITLES[step]}
              </p>
              <div
                role="group"
                aria-labelledby={`${uid}-step-${step}`}
                className="mt-3"
              >
                {step === 0 &&
                  renderPills(SOLUTIONS, solution, setSolution, false)}
                {step === 1 &&
                  renderPills(MODULES, modules, toggleModule, true)}
                {step === 2 && renderPills(URGENCY, urgency, setUrgency, false)}
              </div>

              <div className="mt-auto pt-3 flex items-center justify-between text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
                <span>предварительно</span>
                <span className="text-[#1a1a1a]/70 tabular-nums">
                  {total.toLocaleString("ru-RU")} ₽
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* навигация */}
      <div className="flex items-center justify-between">
        {done ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="text-[11px] lowercase text-[#1a1a1a]/50 hover:text-[#1a1a1a] transition-colors"
            >
              ← поправить параметр
            </button>
            <button
              type="button"
              onClick={reset}
              className="text-[11px] lowercase text-[#1a1a1a]/50 hover:text-[#1a1a1a] transition-colors"
            >
              начать заново
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={step === 0}
              className="text-[11px] lowercase text-[#1a1a1a]/50 hover:text-[#1a1a1a] transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              ← назад
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="rounded-full bg-[#1a1a1a] px-5 py-2 text-xs text-white"
            >
              {step === TOTAL_STEPS - 1 ? "посмотреть смету" : "далее"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
