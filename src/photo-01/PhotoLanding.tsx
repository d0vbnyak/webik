import { useEffect } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";

/* ──────────────────────────────────────────────────────────────────────────
   Шаблон «Фотограф» (photo-01)
   Стиль: редакционный брутализм (Eindhoven Design District) — «печатный журнал,
   ставший интерактивным». Чёрный текст на белой бумаге, серые полосы-разделители,
   красный — ТОЛЬКО на метках-рубриках. Без теней и градиентов.
   Шрифт: Helvetica/Arial (метрики Helvetica, как в исходном референсе).
   Вёрстка mobile-first: на телефоне всё в столбик, асимметрия и поворот слова —
   на десктопе (lg+).
   ────────────────────────────────────────────────────────────────────────── */

// Дизайн-токены — локально, чтобы не трогать общий сайт WebIK
const INK = "#000000";
const PAPER = "#ffffff";
const NEWSPRINT = "#e8e8e8";
const RED = "#ff0000";
const FONT = '"Helvetica Neue", Helvetica, Arial, "Inter", sans-serif';

/* ──────────────────────────────────────────────────────────────────────────
   ФОТОГРАФИИ. Всё в одном месте — заменить заглушку на своё фото можно в ОДНУ
   строку: впишите путь в поле `src`, например src: "/photo-01/fasad-01.jpg".
   Пока src: null — на месте кадра рисуется аккуратная подписанная заглушка.
   `ratio` — пропорции кадра (CSS aspect-ratio), `label` — что это за снимок.
   ────────────────────────────────────────────────────────────────────────── */
type Photo = { src: string | null; label: string; ratio: string };

const PHOTOS = {
  heroTall: { src: null, label: "Фасад", ratio: "3 / 4" },
  heroSquare: { src: null, label: "Деталь", ratio: "1 / 1" },
  heroWide: { src: null, label: "Интерьер", ratio: "4 / 3" },
  work1: { src: null, label: "Бетон и свет", ratio: "4 / 5" },
  work2: { src: null, label: "Тихие пространства", ratio: "4 / 3" },
  work3: { src: null, label: "Утро на рынке", ratio: "3 / 4" },
  work4: { src: null, label: "Лица района", ratio: "1 / 1" },
  work5: { src: null, label: "Геометрия фасадов", ratio: "4 / 5" },
  work6: { src: null, label: "Город меняется", ratio: "4 / 3" },
  featured: { src: null, label: "Город после дождя", ratio: "4 / 3" },
  portrait: { src: null, label: "Портрет фотографа", ratio: "4 / 5" },
} satisfies Record<string, Photo>;

type PhotoId = keyof typeof PHOTOS;

const reduceMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Заглушка под фото: плоская, в палитре газетно-серого, с подписью кадра и
   пропорциями. Без теней/градиентов — на стиль это не влияет. */
function Placeholder({ label, ratio }: { label: string; ratio: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center text-center select-none"
      style={{ color: "#8c8c8c" }}
      aria-hidden="true"
    >
      <span className="absolute inset-3 border border-[#cfcfcf]" />
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
        <rect x="3" y="6" width="18" height="13" />
        <circle cx="12" cy="12.5" r="3.2" />
        <path d="M8 6l1.4-2h5.2L16 6" />
      </svg>
      <span className="mt-3 text-[11px] uppercase tracking-[0.16em]">{label}</span>
      <span className="mt-1 text-[10px] text-[#b3b3b3]">{ratio.replace(/\s/g, "")}</span>
      <span className="mt-2 text-[9px] uppercase tracking-[0.12em] text-[#bdbdbd]">
        добавьте своё фото
      </span>
    </div>
  );
}

/* Кадр: либо реальное фото (если задан src), либо заглушка. Прямоугольный,
   без рамок/скруглений/теней — как требует стиль. */
function Frame({ id, className = "" }: { id: PhotoId; className?: string }) {
  const p = PHOTOS[id];
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: p.ratio, backgroundColor: NEWSPRINT }}
    >
      {p.src ? (
        <img
          src={p.src}
          alt={p.label}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <Placeholder label={p.label} ratio={p.ratio} />
      )}
    </div>
  );
}

/* Плавное проявление секций при прокрутке. Уважает «уменьшить движение». */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 26 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Контейнер контента — макс. ширина как в дизайн-проекте (1200px)
const WRAP = "mx-auto w-full max-w-[1200px] px-5 sm:px-8 lg:px-10";

// Пилюля-ссылка: визуальная база БЕЗ display (чтобы не конфликтовать с `hidden`
// при адаптивном скрытии), плюс готовые варианты с display для обычного применения.
const PILL_BASE =
  "items-center rounded-full border border-black px-4 py-2 text-[15px] sm:text-base transition-colors hover:bg-black hover:text-white";
const PILL_GHOST = `inline-flex ${PILL_BASE}`;
const PILL_FILLED =
  "inline-flex items-center rounded-full bg-black px-4 py-2 text-[15px] sm:text-base text-white transition-colors hover:bg-[#222]";

/* Данные секций */
const WORKS: { id: PhotoId; cat: string; title: string; year: string }[] = [
  { id: "work1", cat: "Архитектура", title: "Бетон и свет", year: "2025" },
  { id: "work2", cat: "Интерьеры", title: "Тихие пространства", year: "2025" },
  { id: "work3", cat: "Репортаж", title: "Утро на рынке", year: "2024" },
  { id: "work4", cat: "Портрет", title: "Лица района", year: "2024" },
  { id: "work5", cat: "Архитектура", title: "Геометрия фасадов", year: "2023" },
  { id: "work6", cat: "Документ", title: "Город меняется", year: "2023" },
];

// Раскладка портфолио: чередуем широкие и узкие колонки → асимметрия (десктоп)
const WORK_SPAN = [
  "sm:col-span-7",
  "sm:col-span-5 sm:mt-16",
  "sm:col-span-5",
  "sm:col-span-7 sm:mt-16",
  "sm:col-span-6",
  "sm:col-span-6 sm:mt-16",
];

const SERVICES = [
  {
    title: "Портретная съёмка",
    desc: "Студия или город, 1–2 часа, 20–30 обработанных кадров",
    price: "от 12 000 ₽",
  },
  {
    title: "Архитектура и интерьеры",
    desc: "Для бюро, девелоперов и изданий",
    price: "от 25 000 ₽",
  },
  {
    title: "Репортаж и события",
    desc: "Конференции, открытия, городские истории",
    price: "от 18 000 ₽",
  },
  {
    title: "Предметная съёмка",
    desc: "Каталоги, лукбуки, карточки товаров",
    price: "от 15 000 ₽",
  },
];

const CONTACTS = [
  { label: "hello@artemvolkov.ru", href: "mailto:hello@artemvolkov.ru" },
  { label: "Telegram", href: "https://t.me/" },
  { label: "Behance", href: "https://www.behance.net/" },
];

export default function PhotoLanding() {
  // Плавная прокрутка к якорям внутри шаблона; возвращаем как было при выходе
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    if (!reduceMotion) document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = prev;
    };
  }, []);

  return (
    <div
      id="top"
      style={{ backgroundColor: PAPER, color: INK, fontFamily: FONT }}
      className="min-h-screen antialiased selection:bg-black selection:text-white"
    >
      {/* ── Шапка: не липкая, логотип-имя слева, пилюли справа ── */}
      <header className="relative z-20">
        <div className={`${WRAP} flex items-center justify-between py-5 sm:py-7`}>
          <a href="#top" className="text-[13px] leading-[1.05] sm:text-sm">
            <span className="block">Артём</span>
            <span className="block">Волков</span>
          </a>
          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Разделы">
            <a href="#work" className={`hidden sm:inline-flex ${PILL_BASE}`}>
              Портфолио
            </a>
            <a href="#services" className={`hidden md:inline-flex ${PILL_BASE}`}>
              Съёмки
            </a>
            <a href="#about" className={`hidden md:inline-flex ${PILL_BASE}`}>
              О себе
            </a>
            <a href="#contact" className={PILL_FILLED}>
              Связаться
            </a>
          </nav>
        </div>
      </header>

      {/* ── Hero: типографическая инсталляция ── */}
      <section className={`${WRAP} pb-10 pt-4 sm:pt-8`}>
        {/* Мобильная версия — столбик, без поворота */}
        <div className="lg:hidden">
          <h1 style={{ fontWeight: 400 }} className="leading-[0.9]">
            <span
              className="block"
              style={{ fontSize: "clamp(3.4rem, 20vw, 7rem)", letterSpacing: "-0.04em" }}
            >
              Артём
            </span>
            <span
              className="block"
              style={{ fontSize: "clamp(3.4rem, 20vw, 7rem)", letterSpacing: "-0.04em" }}
            >
              Волков
            </span>
          </h1>
          <p className="mt-5 max-w-[34ch] text-[18px] leading-[1.31]">
            Документальная и архитектурная фотография. Москва и не только.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <Frame id="heroTall" />
            <Frame id="heroSquare" className="mt-10" />
          </div>
          <div className="mt-3">
            <Frame id="heroWide" />
          </div>
        </div>

        {/* Десктоп — асимметрия + слово, повёрнутое на бок */}
        <div className="hidden min-h-[82vh] lg:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h1
                style={{
                  fontWeight: 400,
                  fontSize: "clamp(5rem, 12vw, 11rem)",
                  letterSpacing: "-0.05em",
                  lineHeight: 0.9,
                }}
              >
                Артём
              </h1>
              <p className="mt-6 max-w-[40ch] text-[19px] leading-[1.31]">
                Документальная и архитектурная фотография. Снимаю пространства,
                фасады и людей в их среде.
              </p>
              {/* Кадры вразброс — лесенкой, как коллаж в референсе */}
              <div className="mt-12 flex items-start gap-6">
                <Frame id="heroTall" className="w-[280px]" />
                <Frame id="heroSquare" className="mt-28 w-[200px]" />
                <Frame id="heroWide" className="mt-52 w-[300px]" />
              </div>
            </div>
            {/* Повёрнутое слово: writing-mode сам резервирует высоту — устойчиво */}
            <div className="shrink-0 pt-2">
              <span
                style={{
                  writingMode: "vertical-rl",
                  fontWeight: 400,
                  fontSize: "clamp(5rem, 12vw, 11rem)",
                  letterSpacing: "-0.05em",
                  lineHeight: 0.9,
                }}
                className="block"
              >
                Волков
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Вступление ── */}
      <section className={`${WRAP} py-16 sm:py-24`}>
        <Reveal>
          <p className="max-w-[620px] text-[20px] leading-[1.4] tracking-[-0.01em] sm:text-[23px]">
            Без постановки и лишнего глянца — только свет, форма и момент. Каждая
            серия для меня документ места и времени, а не каталог красивых кадров.
          </p>
          <a href="#work" className={`mt-8 ${PILL_GHOST}`}>
            Смотреть портфолио
          </a>
        </Reveal>
      </section>

      {/* ── Портфолио ── */}
      <section id="work" className={`${WRAP} scroll-mt-8 pb-20 sm:pb-28`}>
        <Reveal className="mb-10 flex items-end justify-between border-t border-black pt-4 sm:mb-14">
          <h2
            style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
            className="text-[32px] leading-[1] sm:text-[46px]"
          >
            Избранные работы
          </h2>
          <span className="text-[14px] text-[#8c8c8c]">01 — 06</span>
        </Reveal>

        <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-12 sm:gap-y-16">
          {WORKS.map((w, i) => (
            <Reveal key={w.id} className={WORK_SPAN[i]} delay={(i % 2) * 0.08}>
              <Frame id={w.id} />
              <div className="mt-4">
                <span
                  className="text-[14px] uppercase tracking-[0.06em]"
                  style={{ color: RED }}
                >
                  {w.cat}
                </span>
                <div className="mt-1 flex items-baseline justify-between gap-4">
                  <h3
                    style={{ fontWeight: 600, letterSpacing: "-0.01em" }}
                    className="text-[20px] leading-[1.2] sm:text-[23px]"
                  >
                    {w.title}
                  </h3>
                  <span className="shrink-0 text-[14px] text-[#8c8c8c]">{w.year}</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Избранная серия: инвертированная чёрная полоса ── */}
      <section className="bg-black text-white">
        <div className={`${WRAP} grid items-center gap-10 py-20 sm:py-28 lg:grid-cols-2 lg:gap-16`}>
          <Reveal>
            <span
              className="text-[14px] uppercase tracking-[0.1em]"
              style={{ color: RED }}
            >
              Серия
            </span>
            <h2
              style={{ fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 0.95 }}
              className="mt-4 text-[44px] sm:text-[64px]"
            >
              Город после дождя
            </h2>
            <p className="mt-6 max-w-[46ch] text-[18px] leading-[1.4] text-white/70">
              Полгода я возвращался на одни и те же улицы после дождя, чтобы поймать,
              как город отражается сам в себе. 24 кадра о свете, который бывает только
              мокрым вечером.
            </p>
            <a
              href="#contact"
              className="mt-8 inline-flex items-center rounded-full border border-white px-4 py-2 text-[15px] transition-colors hover:bg-white hover:text-black sm:text-base"
            >
              Смотреть серию — 24 кадра
            </a>
          </Reveal>
          <Reveal delay={0.08}>
            <Frame id="featured" />
          </Reveal>
        </div>
      </section>

      {/* ── Услуги: серая полоса ── */}
      <section id="services" className="scroll-mt-8" style={{ backgroundColor: NEWSPRINT }}>
        <div className={`${WRAP} py-20 sm:py-28`}>
          <Reveal>
            <h2
              style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
              className="text-[32px] leading-[1] sm:text-[46px]"
            >
              Съёмки
            </h2>
          </Reveal>
          <div className="mt-10 sm:mt-14">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={(i % 2) * 0.06}>
                <div className="flex flex-col gap-2 border-t border-black py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
                  <h3
                    style={{ fontWeight: 600, letterSpacing: "-0.01em" }}
                    className="text-[23px] leading-[1.15] sm:w-1/3"
                  >
                    {s.title}
                  </h3>
                  <p className="text-[16px] leading-[1.4] text-black/65 sm:flex-1">
                    {s.desc}
                  </p>
                  <span className="text-[18px] sm:text-right">{s.price}</span>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <a href="#contact" className={`mt-12 ${PILL_GHOST}`}>
              Обсудить съёмку
            </a>
          </Reveal>
        </div>
      </section>

      {/* ── О фотографе ── */}
      <section id="about" className={`${WRAP} scroll-mt-8 py-20 sm:py-28`}>
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <Reveal>
            <Frame id="portrait" />
          </Reveal>
          <Reveal delay={0.08}>
            <span className="text-[14px] uppercase tracking-[0.1em]" style={{ color: RED }}>
              О фотографе
            </span>
            <h2
              style={{ fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 0.95 }}
              className="mt-4 text-[40px] sm:text-[56px]"
            >
              Артём Волков
            </h2>
            <div className="mt-6 max-w-[52ch] space-y-4 text-[18px] leading-[1.4] text-black/80">
              <p>
                Фотограф из Москвы. Снимаю с 2015 года: начинал с уличной
                документалистики, сейчас работаю с архитектурными бюро, изданиями и
                брендами.
              </p>
              <p>
                Верю, что хорошая фотография не приукрашивает реальность, а помогает
                её увидеть. Снимаю на плёнку и цифру, монтирую сам, держу серию
                цельной от первого кадра до печати.
              </p>
            </div>
            <div className="mt-10 flex gap-10">
              {[
                { n: "10 лет", l: "в фотографии" },
                { n: "200+", l: "съёмок" },
                { n: "6", l: "выставок" },
              ].map((s) => (
                <div key={s.l}>
                  <div style={{ fontWeight: 600 }} className="text-[28px] leading-none">
                    {s.n}
                  </div>
                  <div className="mt-1.5 text-[13px] text-black/55">{s.l}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Контакт-футер: инвертированная полоса ── */}
      <footer id="contact" className="scroll-mt-8 bg-black text-white">
        <div className={`${WRAP} py-20 sm:py-28`}>
          <Reveal>
            <h2
              style={{ fontWeight: 400, letterSpacing: "-0.04em", lineHeight: 0.9 }}
              className="text-[72px] sm:text-[120px]"
            >
              Снимем?
            </h2>
            <p className="mt-6 max-w-[40ch] text-[18px] leading-[1.4] text-white/70">
              Расскажите про задачу — отвечу в течение дня.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {CONTACTS.map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  className="inline-flex items-center rounded-full border border-white px-4 py-2 text-[15px] transition-colors hover:bg-white hover:text-black sm:text-base"
                >
                  {c.label}
                </a>
              ))}
            </div>
          </Reveal>

          <div className="mt-16 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-white/15 pt-6 text-[12px] text-white/55">
            <Link
              to="/templates"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              ← Все шаблоны WebIK
            </Link>
            <span>© 2026 Артём Волков · Шаблон фотографа</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9fff00]" />
              Сделано в WebIK
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
