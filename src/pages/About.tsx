import { motion } from "motion/react";
import PageHeader from "../components/PageHeader";
import SectionHeading from "../components/SectionHeading";

const STATS = [
  { value: "20+", label: "реализованных проектов" },
  { value: "6 лет", label: "на рынке веб-разработки" },
  { value: "10", label: "клиентов на постоянной поддержке" },
  { value: "4", label: "специалиста в команде" },
];

const PRINCIPLES = [
  {
    title: "Скорость без потери качества",
    text: "Запускаем лендинги за неделю, сложные продукты — за месяц. Чёткие сроки фиксируем в договоре.",
  },
  {
    title: "Прозрачный процесс",
    text: "Еженедельные демо, открытая доска задач и понятные сметы. Вы всегда знаете, за что платите.",
  },
  {
    title: "Дизайн, который продаёт",
    text: "Красота — не самоцель. Каждый экран проектируем под бизнес-задачу и конверсию.",
  },
  {
    title: "AI там, где он полезен",
    text: "Внедряем нейросети не ради хайпа: агенты, боты и автоматизация окупаются за месяцы.",
  },
];

const TEAM = [
  { initials: "ИК", name: "Иван", role: "основатель, продукт" },
  { initials: "АС", name: "Анна", role: "арт-директор" },
  { initials: "ДМ", name: "Дмитрий", role: "ведущий разработчик" },
  { initials: "МЛ", name: "Мария", role: "AI-инженер" },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

export default function About() {
  return (
    <section className="relative bg-bg-base pb-24 md:pb-32 overflow-hidden">
      <PageHeader
        title="Мы — WebIK,"
        accent="студия, где дизайн встречается с AI."
        subtitle="Делаем сайты, ботов и нейросетевые решения, которые приносят заявки, а не просто красиво выглядят. Маленькая команда, большие проекты и никакой бюрократии."
      />

      <div className="max-w-7xl mx-auto px-5 md:px-16 lg:px-20 grid grid-cols-12 gap-x-4 md:gap-x-8">
        <div className="col-span-12 md:col-span-10 md:col-start-2">
          {/* Цифры */}
          <div className="mt-16 md:mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="bg-white rounded-2xl border border-black/[0.05] p-6 shadow-sm"
              >
                <div className="font-display font-medium text-3xl md:text-4xl text-[#1a1a1a]">
                  {stat.value}
                </div>
                <div className="mt-2 text-sm leading-snug text-[#1a1a1a]/55">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Миссия */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.6 }}
            className="mt-20 md:mt-28 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start"
          >
            <SectionHeading
              title="Почему"
              accent="мы?"
              className="text-3xl sm:text-4xl"
            />
            <div className="space-y-4 text-base leading-relaxed text-[#1a1a1a]/65">
              <p>
                Мы начинали как небольшая команда верстальщиков, а выросли в
                студию полного цикла: от первого прототипа до SEO-продвижения и
                голосовых AI-роботов, которые сами обзванивают клиентов.
              </p>
              <p>
                Каждый проект ведёт один менеджер, а решения принимаются за
                день, а не за неделю согласований. Поэтому с нами остаются на
                годы.
              </p>
            </div>
          </motion.div>

          {/* Принципы */}
          <div className="mt-16 md:mt-20 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
            {PRINCIPLES.map((p, i) => (
              <motion.div
                key={p.title}
                {...fadeUp}
                transition={{ duration: 0.5, delay: (i % 2) * 0.1 }}
                className="bg-white rounded-2xl border border-black/[0.05] p-7 shadow-sm"
              >
                <div className="w-8 h-[3px] rounded-full bg-brand-green" />
                <h3 className="mt-5 font-display font-medium text-lg text-[#1a1a1a]">
                  {p.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#1a1a1a]/55">
                  {p.text}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Команда */}
          <SectionHeading
            title="Команда"
            accent="без лишних звеньев."
            {...fadeUp}
            transition={{ duration: 0.6 }}
            className="mt-20 md:mt-28 text-3xl sm:text-4xl"
          />

          <div className="mt-10 md:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {TEAM.map((member, i) => (
              <motion.div
                key={member.initials}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="bg-white rounded-2xl border border-black/[0.05] p-6 shadow-sm text-center"
              >
                <div className="mx-auto w-16 h-16 rounded-full bg-bg-base border border-black/[0.05] flex items-center justify-center font-display font-medium text-lg text-[#1a1a1a]">
                  {member.initials}
                </div>
                <div className="mt-4 font-medium text-sm text-[#1a1a1a]">
                  {member.name}
                </div>
                <div className="mt-1 text-xs lowercase text-[#1a1a1a]/50">
                  {member.role}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
