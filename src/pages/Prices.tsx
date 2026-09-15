import { motion } from "motion/react";
import PageHeader from "../components/PageHeader";
import { PRICES } from "../../shared/prices";
import { openAssistant } from "../components/assistant/events";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

/**
 * Страница прайса. Сами цены — в shared/prices.json, оттуда же их берёт
 * база знаний бота, поэтому сайт и бот не расходятся.
 */
export default function Prices() {
  return (
    <section className="relative bg-bg-base pb-24 md:pb-32 overflow-hidden">
      <PageHeader
        title="Цены —"
        accent="без «рассчитывается индивидуально»."
        subtitle={`${PRICES.note} Смета присылается за день после короткого обсуждения.`}
      />

      <div className="max-w-7xl mx-auto px-8 md:px-16 lg:px-20 grid grid-cols-12 gap-x-4 md:gap-x-8">
        <div className="col-span-12 md:col-span-10 md:col-start-2">
          <div className="mt-16 md:mt-20 space-y-10 md:space-y-14">
            {PRICES.groups.map((group, gi) => (
              <motion.div
                key={group.title}
                {...fadeUp}
                transition={{ duration: 0.5, delay: Math.min(gi, 3) * 0.05 }}
              >
                <h2 className="font-display font-medium text-2xl sm:text-3xl text-[#1a1a1a]">
                  {group.title}
                </h2>

                <dl className="mt-5 bg-white rounded-2xl border border-black/[0.05] shadow-sm overflow-hidden">
                  {group.items.map((item, i) => (
                    <div
                      key={item.name}
                      className={`flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-6 px-5 sm:px-7 py-4 sm:py-5 ${
                        i > 0 ? "border-t border-black/[0.05]" : ""
                      }`}
                    >
                      <dt className="min-w-0">
                        <span className="block text-sm sm:text-base text-[#1a1a1a]">
                          {item.name}
                        </span>
                        {item.note && (
                          <span className="mt-1 block text-xs sm:text-sm leading-snug text-[#1a1a1a]/50">
                            {item.note}
                          </span>
                        )}
                      </dt>
                      <dd className="font-display font-medium text-base sm:text-lg text-[#1a1a1a] whitespace-nowrap shrink-0">
                        {item.price}
                      </dd>
                    </div>
                  ))}
                </dl>
              </motion.div>
            ))}
          </div>

          {/* Расход на модель — то, о чём клиенты узнают последними и зря */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5 }}
            className="mt-12 md:mt-16 rounded-2xl border border-black/[0.05] bg-white p-7 shadow-sm"
          >
            <div className="w-8 h-[3px] rounded-full bg-brand-green" />
            <h3 className="mt-5 font-display font-medium text-lg text-[#1a1a1a]">
              Про расход на нейросеть
            </h3>
            <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-[#1a1a1a]/55">
              {PRICES.modelCost}
            </p>
            <button
              type="button"
              onClick={() => openAssistant()}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1a1a1a] text-white text-sm px-5 py-2.5 transition-opacity hover:opacity-90"
            >
              Запросить смету
            </button>
            <p className="mt-4 text-xs text-[#1a1a1a]/40">
              Прайс пересмотрен{" "}
              {new Date(PRICES.updated).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
