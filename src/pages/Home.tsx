import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Link } from "react-router";
import Hero from "../components/Hero";
import SectionHeading from "../components/SectionHeading";
import { SECTIONS, isVisible } from "../../shared/visibility";

type Service = { title: string; text: string; icon: ReactNode; hidden?: boolean };

// Скрытые услуги (hidden) не показываются — WebIK продаёт ИИ-решения и лендинги
const ALL_SERVICES: Service[] = [
  {
    title: "Лендинги",
    text: "Продающие одностраничники с формой заявки и ИИ-ботом внутри.",
    icon: (
      <path d="M3 5h18v12H3zM3 9h18M8 21h8m-4-4v4" />
    ),
  },
  {
    title: "Веб-дизайн",
    hidden: true,
    text: "UI/UX, айдентика и дизайн-системы, которые продают.",
    icon: (
      <path d="M12 19l7-7-3-3-7 7-1 4zM18 13l-3-3M5 21h.01M3 3l6 6" />
    ),
  },
  {
    title: "Telegram-боты",
    text: "Боты для продаж, поддержки и автоматизации процессов.",
    icon: <path d="M21 4L3 11l6 2 2 6 4-5 5 4zM9 13l9-7" />,
  },
  {
    title: "MAX-боты",
    text: "Боты для российского мессенджера MAX — будьте там, где ваши клиенты.",
    icon: (
      <path d="M21 12a8 8 0 11-4-7M21 12v-2m0 2h-2M8 10h.01M12 10h.01M16 10h.01M8 14h6" />
    ),
  },
  {
    title: "SEO-оптимизация",
    hidden: true,
    text: "Выводим сайты в топ выдачи и приводим органический трафик.",
    icon: (
      <path d="M11 17a6 6 0 100-12 6 6 0 000 12zM21 21l-5-5M8 11l2 2 3-4" />
    ),
  },
  {
    title: "AI-агенты для бизнеса",
    text: "Автономные агенты, которые берут рутину компании на себя.",
    icon: (
      <path d="M9 3h6v4H9zM7 7h10v10H7zM12 17v4M5 11H3m18 0h-2M10 11h.01M14 11h.01" />
    ),
  },
  {
    title: "AI-колл-центр",
    text: "Голосовые роботы принимают и совершают звонки 24/7.",
    icon: (
      <path d="M4 5a2 2 0 012-2h2l2 5-2 1a11 11 0 005 5l1-2 5 2v2a2 2 0 01-2 2A16 16 0 014 5z" />
    ),
  },
  {
    title: "AI-контент",
    text: "Тексты, озвучка и видео для соцсетей и рекламы.",
    icon: (
      <path d="M5 3l1.5 3L10 7.5 6.5 9 5 12 3.5 9 0 7.5 3.5 6zM14 5l2 4 4 2-4 2-2 4-2-4-4-2 4-2zM19 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    ),
  },
];

const SERVICES = ALL_SERVICES.filter(isVisible);

export default function Home() {
  return (
    <>
      <Hero />

      {/* Услуги */}
      <section className="relative z-10 bg-bg-base pb-24 md:pb-32">
        <div className="max-w-7xl mx-auto px-8 md:px-16 lg:px-20 grid grid-cols-12 gap-x-4 md:gap-x-8 pt-20 md:pt-28">
          <div className="col-span-12 md:col-span-10 md:col-start-2">
            <SectionHeading
              title="Что мы делаем"
              accent="— от лендинга до AI-колл-центра."
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7 }}
              className="text-3xl sm:text-4xl lg:text-5xl"
            />

            <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {SERVICES.map((service, i) => (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: (i % 4) * 0.08 }}
                  className="group bg-white rounded-2xl border border-black/[0.05] p-6 shadow-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-bg-base flex items-center justify-center group-hover:bg-brand-green transition-colors duration-300">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1a1a1a"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5"
                      aria-hidden="true"
                    >
                      {service.icon}
                    </svg>
                  </div>
                  <h3 className="mt-5 font-display font-medium text-base text-[#1a1a1a]">
                    {service.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#1a1a1a]/55">
                    {service.text}
                  </p>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mt-12 md:mt-16 flex flex-wrap items-center gap-4"
            >
              <Link
                to="/capabilities"
                className="inline-flex items-center gap-2 bg-[#1a1a1a] text-white text-sm lowercase rounded-full px-6 py-3 hover:bg-black transition-colors"
              >
                посмотреть возможности <span aria-hidden="true">→</span>
              </Link>
              {SECTIONS.templates ? (
                <Link
                  to="/templates"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm lowercase text-[#1a1a1a]/70 hover:text-[#1a1a1a] transition-colors"
                >
                  выбрать шаблон сайта <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <Link
                  to="/prices"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm lowercase text-[#1a1a1a]/70 hover:text-[#1a1a1a] transition-colors"
                >
                  посмотреть цены <span aria-hidden="true">→</span>
                </Link>
              )}
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}
