import { motion } from "motion/react";
import { Link } from "react-router";
import PageHeader from "../components/PageHeader";

type Tpl = {
  name: string;
  category: string;
  ready?: boolean;
  href?: string;
  image?: string;
};

const TEMPLATES: Tpl[] = [
  {
    name: "Лендинг кафе",
    category: "общепит",
    ready: true,
    href: "/templates/coffe-01",
    image: "/coffe-01/preview.jpg?v=2",
  },
  { name: "Интернет-магазин", category: "e-commerce" },
  {
    name: "Портфолио",
    category: "креатив",
    ready: true,
    href: "/templates/portfolio-01",
    image: "/portfolio-01/preview.jpg?v=1",
  },
  { name: "Корпоративный сайт", category: "бизнес" },
  { name: "Салон красоты", category: "услуги" },
  { name: "Фитнес-клуб", category: "спорт" },
  { name: "Стоматология", category: "медицина" },
  { name: "Доставка еды", category: "общепит" },
  { name: "Агентство недвижимости", category: "бизнес" },
  { name: "Юридическая фирма", category: "услуги" },
  { name: "Онлайн-школа", category: "образование" },
  { name: "Автосервис", category: "услуги" },
  { name: "Турагентство", category: "путешествия" },
  { name: "Медицинский центр", category: "медицина" },
  { name: "Строительная компания", category: "бизнес" },
  {
    name: "Сайт фотографа",
    category: "креатив",
    ready: true,
    href: "/templates/photo-01",
    image: "/photo-01/preview.jpg?v=4",
  },
  { name: "Ресторан", category: "общепит" },
  { name: "IT-стартап", category: "технологии" },
  { name: "Магазин одежды", category: "e-commerce" },
  { name: "Барбершоп", category: "услуги" },
];

const ACCENTS = ["#9fff00", "#c7b9ff", "#ffd6a5", "#a5d8ff", "#ffb3c1"];

/** CSS-скелетон макета — четыре чередующихся паттерна */
function SkeletonPreview({ variant, accent }: { variant: number; accent: string }) {
  const bar = "rounded-[3px] bg-zinc-200";

  return (
    <div className="aspect-[4/3] rounded-xl bg-zinc-50 border border-black/[0.04] p-3 overflow-hidden">
      {/* псевдо-шапка */}
      <div className="flex items-center justify-between">
        <div className={`${bar} w-10 h-2`} />
        <div className="flex gap-1.5">
          <div className={`${bar} w-6 h-2`} />
          <div className={`${bar} w-6 h-2`} />
          <div className="w-8 h-3 rounded-full" style={{ backgroundColor: accent }} />
        </div>
      </div>

      {variant === 0 && (
        <>
          <div className="mt-4 space-y-1.5">
            <div className={`${bar} w-3/4 h-3`} />
            <div className={`${bar} w-1/2 h-3`} />
            <div className={`${bar} w-2/5 h-2 opacity-60`} />
          </div>
          <div className="mt-3 w-14 h-4 rounded-full" style={{ backgroundColor: accent }} />
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 rounded-md bg-zinc-200/70" />
            ))}
          </div>
        </>
      )}

      {variant === 1 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-md bg-white border border-black/[0.04] p-2">
              <div
                className="h-8 rounded"
                style={{ backgroundColor: i === 0 ? accent : "#e4e4e7" }}
              />
              <div className={`${bar} mt-1.5 w-3/4 h-1.5`} />
              <div className={`${bar} mt-1 w-1/2 h-1.5 opacity-60`} />
            </div>
          ))}
        </div>
      )}

      {variant === 2 && (
        <div className="mt-4 flex gap-2 h-[70%]">
          <div className="w-1/4 rounded-md bg-zinc-200/70 p-1.5 space-y-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-1.5 rounded bg-white/80" />
            ))}
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="h-12 rounded-md" style={{ backgroundColor: accent }} />
            <div className={`${bar} w-full h-2`} />
            <div className={`${bar} w-2/3 h-2`} />
            <div className={`${bar} w-3/4 h-2 opacity-60`} />
          </div>
        </div>
      )}

      {variant === 3 && (
        <div className="mt-4 flex gap-2 h-[70%]">
          <div className="flex-1 flex flex-col justify-center space-y-1.5">
            <div className={`${bar} w-full h-3`} />
            <div className={`${bar} w-2/3 h-3`} />
            <div className="mt-1 w-12 h-3.5 rounded-full" style={{ backgroundColor: accent }} />
          </div>
          <div className="w-2/5 rounded-md bg-zinc-200/70" />
        </div>
      )}
    </div>
  );
}

/** Стеклянный баннер-приглашение к индивидуальной разработке */
function CustomSiteBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5 }}
      className="relative mt-12 md:mt-16 overflow-hidden rounded-3xl border border-black/[0.05] shadow-[0_12px_40px_-14px_rgba(20,20,20,0.18)]"
    >
      {/* Светлая подложка + мягкие пастельные пятна — фон под матовым стеклом */}
      <div aria-hidden="true" className="absolute inset-0">
        <div className="absolute inset-0 bg-white" />
        <div className="absolute -top-20 -left-12 w-60 h-60 rounded-full bg-[#c7b9ff]/40 blur-3xl" />
        <div className="absolute -bottom-24 right-4 w-72 h-72 rounded-full bg-[#c7b9ff]/45 blur-3xl" />
        <div className="absolute top-6 left-1/2 w-48 h-48 rounded-full bg-[#a5d8ff]/40 blur-3xl" />
      </div>

      {/* Матовая стеклянная панель */}
      <div className="relative m-1.5 sm:m-2 rounded-[1.4rem] border border-white/70 bg-white/40 backdrop-blur-2xl px-6 py-8 sm:px-10 sm:py-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest text-[#1a1a1a]/70">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
              индивидуальная разработка
            </span>
            <h2 className="mt-3 font-display font-medium tracking-tight text-2xl sm:text-3xl leading-[1.15] text-[#1a1a1a]">
              Нет подходящего шаблона для будущего сайта?
            </h2>
            <p className="mt-2 text-sm sm:text-base leading-relaxed text-[#1a1a1a]/70">
              Сделаем индивидуальный — просто напишите нам.
            </p>
          </div>

          <a
            href="mailto:hello@webik.ru"
            className="group/btn inline-flex shrink-0 items-center justify-center gap-2 self-start sm:self-auto rounded-full border border-white/80 bg-white/60 backdrop-blur-md px-6 py-3 text-sm lowercase font-medium text-[#1a1a1a] shadow-[0_8px_24px_-8px_rgba(20,20,20,0.28),inset_0_1px_0_rgba(255,255,255,0.9)] hover:bg-white/85 transition-colors whitespace-nowrap"
          >
            написать нам
            <span aria-hidden="true" className="transition-transform duration-300 group-hover/btn:translate-x-0.5">
              →
            </span>
          </a>
        </div>
      </div>
    </motion.div>
  );
}

export default function Templates() {
  return (
    <section className="relative bg-bg-base pb-24 md:pb-32 overflow-hidden">
      <PageHeader
        title="Шаблоны"
        accent="вашего будущего сайта."
        subtitle="20 готовых направлений: выбирайте основу — а мы адаптируем дизайн, тексты и функциональность под ваш бренд. Три шаблона уже готовы — откройте «Лендинг кафе», «Сайт фотографа» или «Портфолио»."
      />

      <div className="max-w-7xl mx-auto px-8 md:px-16 lg:px-20 grid grid-cols-12 gap-x-4 md:gap-x-8">
        <div className="col-span-12 md:col-span-10 md:col-start-2">
          <CustomSiteBanner />
          <div className="mt-8 md:mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {TEMPLATES.map((tpl, i) => {
              const card = (
                <motion.article
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.45, delay: (i % 4) * 0.06 }}
                  className="group bg-white rounded-2xl border border-black/[0.05] p-3 shadow-sm hover:shadow-md hover:-translate-y-1 active:shadow-md active:-translate-y-1 transition-all duration-300 cursor-pointer"
                >
                  <div className="relative">
                    {tpl.image ? (
                      <div className="aspect-[4/3] rounded-xl overflow-hidden border border-black/[0.04]">
                        <img
                          src={tpl.image}
                          alt={`Превью шаблона «${tpl.name}»`}
                          decoding="async"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04] group-active:scale-[1.04]"
                        />
                      </div>
                    ) : (
                      <SkeletonPreview variant={i % 4} accent={ACCENTS[i % ACCENTS.length]} />
                    )}
                    <span
                      className={`absolute top-2 right-2 text-[10px] lowercase tracking-wide rounded-full px-2.5 py-1 ${
                        tpl.ready ? "bg-brand-green text-black font-medium" : "bg-[#1a1a1a] text-white"
                      }`}
                    >
                      {tpl.ready ? "готово" : "скоро"}
                    </span>
                  </div>
                  <div className="px-2 pt-3 pb-2 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display font-medium text-sm text-[#1a1a1a]">
                        {tpl.name}
                      </h3>
                      <div className="mt-0.5 text-[11px] lowercase text-[#1a1a1a]/45">
                        {tpl.category}
                      </div>
                    </div>
                    <span
                      aria-hidden="true"
                      className="w-7 h-7 shrink-0 rounded-full bg-bg-base flex items-center justify-center text-[#1a1a1a] text-xs group-hover:bg-brand-green group-active:bg-brand-green transition-colors duration-300"
                    >
                      →
                    </span>
                  </div>
                </motion.article>
              );

              return tpl.href ? (
                <Link key={tpl.name} to={tpl.href} className="block">
                  {card}
                </Link>
              ) : (
                <div key={tpl.name}>{card}</div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
