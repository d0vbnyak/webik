import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Option = { id: string; label: string };
type Step = { key: string; question: string; options: Option[] };

const STEPS: Step[] = [
  {
    key: "type",
    question: "что хотите запустить?",
    options: [
      { id: "landing", label: "лендинг" },
      { id: "shop", label: "интернет-магазин" },
      { id: "service", label: "веб-сервис" },
      { id: "bot", label: "telegram-бот" },
    ],
  },
  {
    key: "budget",
    question: "ориентир по бюджету?",
    options: [
      { id: "s", label: "до 100 тыс" },
      { id: "m", label: "100–300 тыс" },
      { id: "l", label: "300 тыс+" },
    ],
  },
  {
    key: "deadline",
    question: "когда нужен результат?",
    options: [
      { id: "fast", label: "вчера" },
      { id: "month", label: "за месяц" },
      { id: "flex", label: "не горит" },
    ],
  },
];

/**
 * Многошаговый квиз с прогресс-баром и слайд-переходами.
 * Эмуляция: ответы копятся локально, в конце — экран-резюме без отправки.
 */
export default function QuizSteps() {
  const uid = useId();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [dir, setDir] = useState(1);

  const total = STEPS.length;
  const done = step >= total;
  const progress = Math.min(step, total) / total;

  const pick = (key: string, optId: string) => {
    setAnswers((a) => ({ ...a, [key]: optId }));
    setDir(1);
    setStep((s) => s + 1);
  };

  const back = () => {
    setDir(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  const reset = () => {
    setAnswers({});
    setDir(-1);
    setStep(0);
  };

  const slide = reduce ? 0 : 40;

  return (
    <div className="w-full max-w-[460px] mx-auto space-y-4">
      {/* прогресс-бар */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 rounded-full bg-[#1a1a1a]/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-brand-green"
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          />
        </div>
        <span className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40 tabular-nums">
          {Math.min(step + (done ? 0 : 1), total)} / {total}
        </span>
      </div>

      {/* контейнер фиксированной высоты — меняется только содержимое шага */}
      <div className="relative h-[210px] overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          {done ? (
            <motion.div
              key="summary"
              custom={dir}
              initial={{ opacity: 0, x: slide }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -slide }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex flex-col"
            >
              <div className="flex-1 bg-white rounded-xl border border-black/[0.05] shadow-sm p-4">
                <div className="flex items-center gap-2">
                  <span className="grid place-items-center w-6 h-6 rounded-full bg-brand-green text-[#1a1a1a] text-xs">
                    ✓
                  </span>
                  <p className="font-display font-medium text-[#1a1a1a]">
                    спасибо, подберём решение
                  </p>
                </div>
                <div className="mt-3 space-y-1.5">
                  {STEPS.map((s) => {
                    const opt = s.options.find((o) => o.id === answers[s.key]);
                    return (
                      <div
                        key={s.key}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-[#1a1a1a]/45 lowercase">
                          {s.question.replace(/[?]/g, "")}
                        </span>
                        <span className="text-[#1a1a1a] font-medium lowercase">
                          {opt?.label ?? "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                className="mt-3 self-start text-[11px] lowercase text-[#1a1a1a]/50 hover:text-[#1a1a1a] transition-colors"
              >
                ← пройти заново
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={STEPS[step].key}
              custom={dir}
              initial={{ opacity: 0, x: dir * slide }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -slide }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex flex-col"
            >
              <p
                id={`${uid}-q-${step}`}
                className="font-display font-medium text-[#1a1a1a]"
              >
                {STEPS[step].question}
              </p>
              <div
                role="group"
                aria-labelledby={`${uid}-q-${step}`}
                className="mt-3 flex flex-wrap gap-2"
              >
                {STEPS[step].options.map((opt) => {
                  const active = answers[STEPS[step].key] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => pick(STEPS[step].key, opt.id)}
                      aria-pressed={active}
                      className={`text-xs lowercase rounded-full px-3.5 py-2 border transition-colors ${
                        active
                          ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                          : "bg-white text-[#1a1a1a]/70 border-black/[0.08] hover:border-black/20"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-auto pt-3">
                <button
                  type="button"
                  onClick={back}
                  disabled={step === 0}
                  className="text-[11px] lowercase text-[#1a1a1a]/50 hover:text-[#1a1a1a] transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  ← назад
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
