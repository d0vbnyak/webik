import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const HINTS = ["конфигуратор товара", "калькулятор доставки", "квиз-подбор", "мини-игра за скидку"];

/**
 * CTA-карточка «Заказать свою идею»: посетитель описывает нужный виджет.
 * Эмуляция: ничего не отправляется — показываем дружелюбное подтверждение.
 */
export default function OrderIdeaCard() {
  const uid = useId();
  const [idea, setIdea] = useState("");
  const [sent, setSent] = useState(false);

  const submit = () => {
    if (idea.trim().length > 2) setSent(true);
  };

  return (
    <div className="w-full max-w-[460px] mx-auto">
      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center gap-3 py-4"
          >
            <span className="grid place-items-center w-12 h-12 rounded-full bg-brand-green text-[#1a1a1a] text-2xl">
              ✓
            </span>
            <p className="font-display font-medium text-lg text-[#1a1a1a]">
              идея принята
            </p>
            <p className="text-sm leading-relaxed text-[#1a1a1a]/55 max-w-xs">
              соберём такой виджет под ваш сайт и покажем демо. это, конечно,
              демонстрация — но в жизни всё работает так же быстро.
            </p>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setIdea("");
              }}
              className="text-[11px] lowercase text-[#1a1a1a]/50 hover:text-[#1a1a1a] transition-colors"
            >
              ← придумать ещё
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div>
              <p className="font-display font-medium text-lg text-[#1a1a1a]">
                не нашли нужный виджет?
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[#1a1a1a]/55">
                опишите свою идею — соберём интерактив под вашу задачу.
              </p>
            </div>

            <label htmlFor={`${uid}-idea`} className="sr-only">
              опишите идею виджета
            </label>
            <textarea
              id={`${uid}-idea`}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={2}
              placeholder="например: калькулятор стоимости ремонта по площади"
              className="w-full resize-none rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#1a1a1a]/35 focus:border-[#1a1a1a]/30 focus:outline-none"
            />

            <div className="flex flex-wrap gap-1.5">
              {HINTS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() =>
                    // не затираем введённый текст: пустое поле — вставляем,
                    // иначе дописываем подсказку через запятую
                    setIdea((prev) =>
                      prev.trim() ? `${prev.trim()}, ${h}` : h,
                    )
                  }
                  className="text-[11px] lowercase rounded-full px-2.5 py-1 border border-black/[0.08] bg-white text-[#1a1a1a]/55 hover:border-black/20 transition-colors"
                >
                  {h}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={idea.trim().length <= 2}
              className="w-full rounded-full bg-[#1a1a1a] py-2.5 text-sm text-white transition-opacity disabled:opacity-30 disabled:pointer-events-none"
            >
              отправить идею →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
