import { motion } from "motion/react";
import type { ReactNode } from "react";
import PageHeader from "../components/PageHeader";

/* ---------- CSS/SVG-мокапы направлений ---------- */

function BotMockup() {
  return (
    <div className="rounded-xl bg-zinc-50 border border-black/[0.04] p-4 space-y-2.5">
      <div className="flex items-center gap-2 pb-2 border-b border-black/[0.05]">
        <span className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center text-brand-green text-[10px] font-bold">
          ИК
        </span>
        <div>
          <div className="text-xs font-medium text-[#1a1a1a]">WebIK Бот</div>
          <div className="text-[10px] text-emerald-600">онлайн</div>
        </div>
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-white border border-black/[0.04] px-3 py-2 text-xs text-[#1a1a1a]/80">
        Здравствуйте! Подобрать вам тариф?
      </div>
      <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-[#1a1a1a] px-3 py-2 text-xs text-white w-fit">
        Да, для интернет-магазина
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-white border border-black/[0.04] px-3 py-2 text-xs text-[#1a1a1a]/80">
        Отлично! Вот 3 варианта под ваш бюджет ↓
      </div>
      <div className="flex gap-1.5 pt-1">
        {["Старт", "Бизнес", "Про"].map((t) => (
          <span
            key={t}
            className="text-[10px] rounded-full border border-[#1a1a1a]/15 px-2.5 py-1 text-[#1a1a1a]/70"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function SeoMockup() {
  return (
    <div className="rounded-xl bg-zinc-50 border border-black/[0.04] p-4">
      <div className="flex items-center justify-between text-[10px] text-[#1a1a1a]/50">
        <span>позиции в поиске</span>
        <span className="text-emerald-600 font-medium">+312% трафика</span>
      </div>
      <svg viewBox="0 0 200 80" className="mt-2 w-full" aria-hidden="true">
        <polyline
          points="0,70 30,65 60,55 90,50 120,35 150,25 180,15 200,8"
          fill="none"
          stroke="#9fff00"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <polyline
          points="0,70 30,65 60,55 90,50 120,35 150,25 180,15 200,8 200,80 0,80"
          fill="#9fff00"
          opacity="0.12"
        />
        {[70, 55, 35, 15].map((y, i) => (
          <circle key={i} cx={i * 60} cy={y} r="3" fill="#1a1a1a" />
        ))}
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {[
          ["ТОП-3", "12 запросов"],
          ["ТОП-10", "47 запросов"],
          ["рост", "за 4 месяца"],
        ].map(([a, b]) => (
          <div key={a} className="rounded-md bg-white border border-black/[0.04] p-2 text-center">
            <div className="text-xs font-semibold text-[#1a1a1a]">{a}</div>
            <div className="text-[9px] text-[#1a1a1a]/50">{b}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentMockup() {
  const steps = [
    { label: "Заявка с сайта", state: "done" },
    { label: "AI-агент уточняет детали", state: "active" },
    { label: "Сделка в CRM", state: "next" },
  ];
  return (
    <div className="rounded-xl bg-zinc-50 border border-black/[0.04] p-4 space-y-2">
      {steps.map((step, i) => (
        <div key={step.label}>
          <div
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
              step.state === "active"
                ? "bg-[#1a1a1a] border-[#1a1a1a]"
                : "bg-white border-black/[0.04]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                step.state === "done"
                  ? "bg-emerald-500"
                  : step.state === "active"
                    ? "bg-brand-green animate-pulse"
                    : "bg-zinc-300"
              }`}
            />
            <span
              className={`text-xs ${
                step.state === "active" ? "text-white" : "text-[#1a1a1a]/75"
              }`}
            >
              {step.label}
            </span>
            {step.state === "active" && (
              <span className="ml-auto text-[9px] text-brand-green lowercase">
                работает…
              </span>
            )}
          </div>
          {i < steps.length - 1 && (
            <div className="ml-[18px] h-3 w-px bg-zinc-300" />
          )}
        </div>
      ))}
    </div>
  );
}

function CallMockup() {
  const heights = [8, 14, 22, 30, 24, 34, 18, 28, 12, 20, 26, 10, 16, 24, 8];
  return (
    <div className="rounded-xl bg-zinc-50 border border-black/[0.04] p-4">
      <div className="flex items-center gap-2">
        <span className="relative flex w-2.5 h-2.5">
          <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-medium text-[#1a1a1a]">
          Исходящий звонок · 00:42
        </span>
      </div>
      <div className="mt-3 flex items-end gap-1 h-10">
        {heights.map((h, i) => (
          <motion.span
            key={i}
            animate={{ height: [h * 0.4, h, h * 0.5] }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              repeatType: "mirror",
              delay: i * 0.07,
            }}
            className="w-1.5 rounded-full bg-[#1a1a1a]"
            style={{ height: h }}
          />
        ))}
      </div>
      <div className="mt-3 rounded-lg bg-white border border-black/[0.04] px-3 py-2 text-[11px] text-[#1a1a1a]/70 italic">
        «Добрый день! Напоминаю о записи на завтра в 14:00. Вам удобно?»
      </div>
    </div>
  );
}

/* ---------- Данные направлений ---------- */

type Work = {
  tag: string;
  title: string;
  accent: string;
  text: string;
  features: string[];
  caseLine: string;
  mockup: ReactNode;
};

const WORKS: Work[] = [
  {
    tag: "боты",
    title: "Telegram и MAX-боты",
    accent: "— продажи на автопилоте.",
    text: "Проектируем и запускаем ботов для Telegram и российского мессенджера MAX: приём заказов, запись клиентов, рассылки и поддержка без операторов.",
    features: [
      "интеграция с CRM и оплатой",
      "сценарии продаж и прогрева",
      "админ-панель и аналитика",
    ],
    caseLine: "Кейс: бот записи для сети салонов — 68% записей без администратора.",
    mockup: <BotMockup />,
  },
  {
    tag: "продвижение",
    title: "SEO-оптимизация",
    accent: "— трафик, который растёт сам.",
    text: "Технический аудит, семантика, контент и ссылочный профиль. Выводим сайты в топ Яндекса и Google и удерживаем позиции.",
    features: [
      "аудит и стратегия за 7 дней",
      "контент-план под ключевые запросы",
      "прозрачные отчёты каждый месяц",
    ],
    caseLine: "Кейс: интернет-магазин мебели — рост органики +312% за 4 месяца.",
    mockup: <SeoMockup />,
  },
  {
    tag: "автоматизация",
    title: "AI-агенты для бизнеса",
    accent: "— сотрудники, которые не спят.",
    text: "Агенты обрабатывают заявки, ведут переписку, готовят документы и передают данные в CRM. Человек подключается только к сложным случаям.",
    features: [
      "обучение на ваших данных и регламентах",
      "интеграции: CRM, почта, мессенджеры",
      "контроль качества и эскалация на человека",
    ],
    caseLine: "Кейс: агент первичной квалификации лидов — экономия 120 часов в месяц.",
    mockup: <AgentMockup />,
  },
  {
    tag: "голос",
    title: "AI-колл-центр",
    accent: "— звонки 24/7 без выходных.",
    text: "Голосовые роботы с естественной речью: подтверждение записей, обзвон базы, NPS-опросы и первая линия поддержки на входящих.",
    features: [
      "естественный голос и перебивания",
      "до 1000 звонков в час",
      "записи и расшифровки в CRM",
    ],
    caseLine: "Кейс: подтверждение доставок — минус 35% недозвонов и срывов.",
    mockup: <CallMockup />,
  },
];

export default function Works() {
  return (
    <section className="relative bg-bg-base pb-24 md:pb-32 overflow-hidden">
      <PageHeader
        title="Другие работы"
        accent="— за пределами сайтов."
        subtitle="Боты, продвижение и нейросети: четыре направления, которые усиливают ваш сайт и разгружают команду."
      />

      <div className="max-w-7xl mx-auto px-8 md:px-16 lg:px-20 grid grid-cols-12 gap-x-4 md:gap-x-8">
        <div className="col-span-12 md:col-span-10 md:col-start-2 mt-16 md:mt-20 space-y-16 md:space-y-24">
          {WORKS.map((work, i) => (
            <motion.article
              key={work.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
              className={`grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-14 items-center ${
                i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div>
                <span className="inline-block text-[11px] lowercase tracking-widest bg-white border border-black/[0.05] rounded-full px-3 py-1 text-[#1a1a1a]/60">
                  {work.tag}
                </span>
                <h2 className="mt-4 font-display font-medium tracking-tight text-2xl sm:text-3xl lg:text-4xl">
                  <span className="text-[#1a1a1a]">{work.title}</span>{" "}
                  <span className="text-[#8e8e8e]">{work.accent}</span>
                </h2>
                <p className="mt-4 text-sm md:text-base leading-relaxed text-[#1a1a1a]/60">
                  {work.text}
                </p>
                <ul className="mt-5 space-y-2">
                  {work.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-[#1a1a1a]/75">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-green border border-[#1a1a1a]/20" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 text-xs leading-relaxed text-[#1a1a1a]/45 border-l-2 border-brand-green pl-3">
                  {work.caseLine}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-black/[0.05] p-4 md:p-6 shadow-sm">
                {work.mockup}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
