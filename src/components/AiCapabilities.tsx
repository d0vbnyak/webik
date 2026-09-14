import { motion } from "motion/react";
import { isVisible } from "../../shared/visibility";
import type { ReactNode } from "react";

/* ---------- Иконки (линейные inline-SVG в едином стиле) ---------- */

/** Обёртка иконки: единый viewBox, штрих и размер. Внутри — только пути. */
function Ic({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const icons = {
  // Контент и тексты
  seo: (
    <Ic>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" />
      <path d="M9 9.5h4M9 12h3" />
    </Ic>
  ),
  pen: (
    <Ic>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Ic>
  ),
  stack: (
    <Ic>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </Ic>
  ),
  feed: (
    <Ic>
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1.4" />
    </Ic>
  ),
  mail: (
    <Ic>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </Ic>
  ),
  // Чат-боты и ассистенты
  chat: (
    <Ic>
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l.9-5.2A8 8 0 1 1 21 12Z" />
      <path d="M9 11h.01M12 11h.01M15 11h.01" />
    </Ic>
  ),
  calendar: (
    <Ic>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
      <path d="m9 14 2 2 4-4" />
    </Ic>
  ),
  book: (
    <Ic>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z" />
    </Ic>
  ),
  phone: (
    <Ic>
      <path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 3 6.2 2 2 0 0 1 5 4Z" />
    </Ic>
  ),
  grad: (
    <Ic>
      <path d="m12 4 9 4-9 4-9-4 9-4Z" />
      <path d="M7 10v4a5 3 0 0 0 10 0v-4" />
      <path d="M21 8v5" />
    </Ic>
  ),
  // Аудио и видео
  transcript: (
    <Ic>
      <path d="M12 4v9" />
      <path d="M9 7v3M15 7v3M6 9v1M18 9v1" />
      <path d="M4 17h16M4 20h11" />
    </Ic>
  ),
  speaker: (
    <Ic>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16.5 9.5a3 3 0 0 1 0 5M19 7a6 6 0 0 1 0 10" />
    </Ic>
  ),
  scissors: (
    <Ic>
      <circle cx="6" cy="7" r="2.4" />
      <circle cx="6" cy="17" r="2.4" />
      <path d="M8 8.5 20 17M8 15.5 20 7" />
    </Ic>
  ),
  avatar: (
    <Ic>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="12" cy="10.5" r="2.4" />
      <path d="M8 17a4 4 0 0 1 8 0" />
    </Ic>
  ),
  headphones: (
    <Ic>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="13.5" width="4" height="6" rx="1.5" />
      <rect x="17" y="13.5" width="4" height="6" rx="1.5" />
    </Ic>
  ),
  // Графика и дизайн
  image: (
    <Ic>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m4 17 4.5-4.5 4 3.5L16 12l4 4" />
    </Ic>
  ),
  spark: (
    <Ic>
      <path d="M12 3v18M3 12h18" />
      <path d="m6 6 12 12M18 6 6 18" opacity="0.45" />
    </Ic>
  ),
  camera: (
    <Ic>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3" />
    </Ic>
  ),
  shirt: (
    <Ic>
      <path d="M8 4 4 7l2 3 2-1v9h8v-9l2 1 2-3-4-3-2 2H10Z" />
    </Ic>
  ),
  // Данные и аналитика
  bars: (
    <Ic>
      <path d="M4 20h16" />
      <rect x="5" y="11" width="3.2" height="6" rx="0.8" />
      <rect x="10.4" y="7" width="3.2" height="10" rx="0.8" />
      <rect x="15.8" y="13" width="3.2" height="4" rx="0.8" />
    </Ic>
  ),
  reviews: (
    <Ic>
      <path d="m12 4 2.1 4.4 4.9.6-3.6 3.3 1 4.7L12 14.8 7.6 17l1-4.7L5 9l4.9-.6Z" />
    </Ic>
  ),
  scope: (
    <Ic>
      <circle cx="11" cy="11" r="7" />
      <path d="M11 6v2M11 14v2M6 11h2M14 11h2" />
      <path d="m17 17 3 3" />
    </Ic>
  ),
  query: (
    <Ic>
      <ellipse cx="12" cy="6" rx="7" ry="2.6" />
      <path d="M5 6v6c0 1.4 3.1 2.6 7 2.6" />
      <path d="M5 12v6c0 1.4 3.1 2.6 7 2.6" />
      <path d="M16.5 16.5a2 2 0 1 1 1.4 2.3M18 21h.01" />
    </Ic>
  ),
  scan: (
    <Ic>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M4 12h16" />
    </Ic>
  ),
  // Автоматизация процессов
  funnel: (
    <Ic>
      <path d="M3 5h18l-7 8v6l-4-2v-4Z" />
    </Ic>
  ),
  shield: (
    <Ic>
      <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6Z" />
      <path d="m9 12 2 2 4-4" />
    </Ic>
  ),
  contract: (
    <Ic>
      <path d="M7 3h7l4 4v14H7Z" />
      <path d="M14 3v4h4" />
      <path d="m9.5 14 1.5 1.5 3-3" />
    </Ic>
  ),
  slides: (
    <Ic>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M12 16v4M9 21h6" />
      <path d="M7 9.5h6M7 12h4" />
    </Ic>
  ),
  cart: (
    <Ic>
      <path d="M3 4h2l2 11h10l2-7H6" />
      <circle cx="9" cy="19" r="1.4" />
      <circle cx="17" cy="19" r="1.4" />
    </Ic>
  ),
  globe: (
    <Ic>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
      <path d="M12 4c2.5 2.2 2.5 13.8 0 16M12 4c-2.5 2.2-2.5 13.8 0 16" />
    </Ic>
  ),
} as const;

/* ---------- Данные каталога (тексты — копирайт WebIK) ---------- */

// hidden: услуга снята с продажи — не показывается, но данные сохранены
type Service = { title: string; blurb: string; icon: ReactNode; hidden?: boolean };
type Category = { title: string; services: Service[] };

const ALL_CATEGORIES: Category[] = [
  {
    title: "Контент и тексты",
    services: [
      { title: "SEO-статьи под ключ", blurb: "тексты под нужные ключи без ручного редактирования", icon: icons.seo },
      { title: "Копирайтинг для лендингов", blurb: "продающие формулировки, которые удерживают и конвертируют", icon: icons.pen },
      { title: "Описания товаров массово", blurb: "сотни карточек по шаблону — быстро и без потери качества", icon: icons.stack },
      { title: "Ведение блога и канала", blurb: "контент-план, посты и публикации без участия редактора", icon: icons.feed },
      { title: "Email-цепочки прогрева", blurb: "персональные письма под сегменты без ручного написания", icon: icons.mail },
    ],
  },
  {
    title: "Чат-боты и ассистенты",
    services: [
      { title: "Бот поддержки на сайт", blurb: "отвечает на вопросы клиентов по базе знаний компании", icon: icons.chat },
      { title: "Бот записи на услуги", blurb: "клиент записывается сам — без звонков и менеджера", icon: icons.calendar },
      { title: "Корпоративный ассистент", blurb: "сотрудник находит ответ во внутренней базе за секунды", icon: icons.book },
      { title: "Голосовой обзвон", blurb: "подтверждает заказы и напоминает о записях без оператора", icon: icons.phone },
      { title: "Обучающий тренажёр", blurb: "AI-репетитор, который адаптируется под уровень ученика", icon: icons.grad },
    ],
  },
  {
    title: "Аудио и видео",
    services: [
      { title: "Транскрибация встреч", blurb: "звонок превращается в текст и саммари за пару минут", icon: icons.transcript },
      { title: "Озвучка и дубляж", blurb: "естественный голос поверх текста или чужой дорожки", icon: icons.speaker },
      { title: "Нарезка Reels и Shorts", blurb: "из длинного видео — готовые клипы для соцсетей", icon: icons.scissors },
      { title: "AI-аватар для видео", blurb: "говорящий персонаж для рекламы и презентаций без съёмки", icon: icons.avatar },
      { title: "Аудиоверсии статей", blurb: "подкаст или аудио из текста без студии и диктора", icon: icons.headphones },
    ],
  },
  {
    title: "Графика и дизайн",
    services: [
      { title: "Изображения для рекламы", blurb: "уникальные визуалы для соцсетей без фотографа и дизайнера", icon: icons.image },
      { title: "Логотип и брендинг", blurb: "базовый фирменный стиль быстро и без долгих согласований", icon: icons.spark, hidden: true },
      { title: "Виртуальная фотосессия", blurb: "предметные фото товаров на любом фоне без аренды студии", icon: icons.camera },
      { title: "Примерка в магазине", blurb: "покупатель видит вещь на себе — без возвратов и сомнений", icon: icons.shirt },
    ],
  },
  {
    title: "Данные и аналитика",
    services: [
      { title: "Парсинг и дашборды", blurb: "собираем данные и показываем нужное одним экраном", icon: icons.bars },
      { title: "Анализ отзывов", blurb: "тональность и тренды по бренду без ручного мониторинга", icon: icons.reviews },
      { title: "Разведка конкурентов", blurb: "цены, контент и позиционирование — в одном отчёте", icon: icons.scope },
      { title: "BI на языке вопросов", blurb: "задаёте вопрос текстом — получаете готовый отчёт", icon: icons.query },
      { title: "OCR-оцифровка", blurb: "документы, чеки и анкеты — в структурированные данные", icon: icons.scan },
    ],
  },
  {
    title: "Автоматизация процессов",
    services: [
      { title: "Скоринг лидов и CRM", blurb: "горячие контакты сами попадают к нужному менеджеру", icon: icons.funnel },
      { title: "Модерация комментариев", blurb: "автоответы и фильтрация негатива в соцсетях без модератора", icon: icons.shield },
      { title: "Анализ договоров", blurb: "риски и ключевые условия документа — за минуту", icon: icons.contract },
      { title: "Автогенерация КП", blurb: "коммерческое предложение под клиента без шаблонной работы", icon: icons.slides },
      { title: "Рекомендации в магазине", blurb: "система подбирает допродажи под каждого покупателя", icon: icons.cart },
      { title: "Перевод и локализация", blurb: "сайт и контент на новый язык без переводческого агентства", icon: icons.globe },
    ],
  },
];

/* ---------- Карточка одной услуги ---------- */

function ServiceCard({ service, i }: { service: Service; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: (i % 3) * 0.06 }}
      className="group h-full rounded-2xl bg-white border border-black/[0.05] shadow-sm p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-brand-green/50"
    >
      <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-brand-green/20 ring-1 ring-inset ring-brand-green/30 text-[#1a1a1a] transition-colors duration-200 group-hover:bg-brand-green">
        {service.icon}
      </span>
      <h4 className="mt-4 font-display font-medium text-[15px] leading-snug text-[#1a1a1a]">
        {service.title}
      </h4>
      <p className="mt-1.5 text-sm leading-relaxed text-[#1a1a1a]/55">
        {service.blurb}
      </p>
    </motion.div>
  );
}

const CATEGORIES: Category[] = ALL_CATEGORIES.map((cat) => ({
  ...cat,
  services: cat.services.filter(isVisible),
})).filter((cat) => cat.services.length > 0);

const SERVICES_COUNT = CATEGORIES.reduce((sum, cat) => sum + cat.services.length, 0);

/** Русское склонение: 1 услуга, 2 услуги, 5 услуг. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/* ---------- Секция-каталог AI-возможностей ---------- */

export default function AiCapabilities() {
  return (
    <div className="mt-24 md:mt-32">
      {/* Шапка блока */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
      >
        <span className="text-xs uppercase tracking-[0.2em] text-[#1a1a1a]/40">
          AI под ключ
        </span>
        <h2 className="mt-3 font-display font-medium tracking-tight text-3xl sm:text-4xl lg:text-5xl leading-[1.12]">
          <span className="text-[#1a1a1a]">{SERVICES_COUNT} {plural(SERVICES_COUNT, "AI-решение", "AI-решения", "AI-решений")}</span>
          <span className="text-[#8e8e8e]"> — для контента, продаж и рутины.</span>
        </h2>
        <p className="mt-5 max-w-2xl text-base md:text-lg leading-relaxed text-[#1a1a1a]/60">
          Берём на себя повторяющуюся работу с текстом, данными и коммуникациями —
          вы занимаетесь бизнесом.
        </p>
      </motion.div>

      {/* Категории */}
      <div className="mt-14 md:mt-16 space-y-14 md:space-y-20">
        {CATEGORIES.map((cat, ci) => (
          <div key={cat.title}>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
              className="flex items-baseline gap-3 border-b border-black/[0.07] pb-4"
            >
              <span className="font-display text-sm tabular-nums text-[#1a1a1a]/30">
                {String(ci + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display font-medium tracking-tight text-xl sm:text-2xl text-[#1a1a1a]">
                {cat.title}
              </h3>
              <span className="ml-auto text-xs text-[#1a1a1a]/35 whitespace-nowrap">
                {cat.services.length} {plural(cat.services.length, "услуга", "услуги", "услуг")}
              </span>
            </motion.div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 items-stretch">
              {cat.services.map((service, i) => (
                <ServiceCard key={service.title} service={service} i={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
