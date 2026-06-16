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
   ФОТОГРАФИИ. Всё в одном месте — заменить кадр можно в ОДНУ строку: меняете путь
   в поле `src` (файл кладёте в public/photo-01/). Если поставить src: null —
   вместо фото рисуется аккуратная подписанная заглушка. `ratio` — пропорции
   кадра (CSS aspect-ratio), `label` — что это за снимок (идёт в alt).
   ASSET_V — версия ассетов: меняйте при замене файла, чтобы браузер не показывал
   старую картинку из кеша.
   ────────────────────────────────────────────────────────────────────────── */
type Photo = { src: string | null; label: string; ratio: string };

const ASSET_V = "1";

const PHOTOS = {
  // Коллажи во весь экран в начале лендинга
  heroWide: { src: `/photo-01/hero-wide.jpg?v=${ASSET_V}`, label: "Коллаж работ", ratio: "16 / 9" },
  heroTall: { src: `/photo-01/hero-tall.jpg?v=${ASSET_V}`, label: "Коллаж работ", ratio: "9 / 16" },
  // Портфолио
  workDance: { src: `/photo-01/work-dance.jpg?v=${ASSET_V}`, label: "Полёт", ratio: "4 / 5" },
  workPortrait: { src: `/photo-01/work-portrait.jpg?v=${ASSET_V}`, label: "Тёплый свет", ratio: "4 / 5" },
  workEye: { src: `/photo-01/work-eye.jpg?v=${ASSET_V}`, label: "Взгляд", ratio: "1 / 1" },
  workWindow: { src: `/photo-01/work-window.jpg?v=${ASSET_V}`, label: "На рассвете", ratio: "4 / 5" },
  // О фотографе
  about: { src: `/photo-01/about.jpg?v=${ASSET_V}`, label: "Портрет фотографа", ratio: "4 / 5" },
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

// Белые варианты пилюль — для навигации поверх фото-hero
const PILL_BASE_W =
  "items-center rounded-full border border-white/80 px-4 py-2 text-[15px] sm:text-base text-white transition-colors hover:bg-white hover:text-black";
const PILL_FILLED_W =
  "inline-flex items-center rounded-full bg-white px-4 py-2 text-[15px] sm:text-base text-black transition-colors hover:bg-white/85";

/* Данные секций */
const WORKS: { id: PhotoId; cat: string; title: string; year: string }[] = [
  { id: "workDance", cat: "Движение", title: "Полёт", year: "2025" },
  { id: "workPortrait", cat: "Портрет", title: "Тёплый свет", year: "2025" },
  { id: "workEye", cat: "Деталь", title: "Взгляд", year: "2024" },
  { id: "workWindow", cat: "История", title: "На рассвете", year: "2024" },
];

// Раскладка портфолио: чередуем широкие и узкие колонки → асимметрия (десктоп)
const WORK_SPAN = [
  "sm:col-span-7",
  "sm:col-span-5 sm:mt-20",
  "sm:col-span-5",
  "sm:col-span-7 sm:mt-20",
];

const SERVICES = [
  {
    title: "Портретная съёмка",
    desc: "Студия или город, 1–2 часа, 20–30 обработанных кадров",
    price: "от 12 000 ₽",
  },
  {
    title: "Love-story и пары",
    desc: "Съёмка-прогулка вашей истории — дома или на улицах города",
    price: "от 18 000 ₽",
  },
  {
    title: "Семейная съёмка",
    desc: "Тёплые кадры о близких, без постановки и натянутых улыбок",
    price: "от 16 000 ₽",
  },
  {
    title: "Репортаж и события",
    desc: "Свадьбы, концерты, городские истории",
    price: "договорная",
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
      {/* ── Hero: полноэкранный коллаж работ ── */}
      <section className="relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-black">
        {/* Коллаж: широкий 16:9 на десктопе/планшете, вертикальный 9:16 на телефоне */}
        <img
          src={PHOTOS.heroWide.src!}
          alt="Коллаж работ фотографа Артёма Волкова"
          decoding="async"
          className="absolute inset-0 hidden h-full w-full object-cover sm:block"
        />
        <img
          src={PHOTOS.heroTall.src!}
          alt="Коллаж работ фотографа Артёма Волкова"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover sm:hidden"
        />
        {/* Затемнение по краям — только ради читаемости текста (фото в центре чистое) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.78) 100%)",
          }}
        />

        {/* Навигация поверх фото */}
        <header className="absolute inset-x-0 top-0 z-20">
          <div className={`${WRAP} flex items-center justify-between py-5 sm:py-7`}>
            <a href="#top" className="text-[13px] leading-[1.05] text-white sm:text-sm">
              <span className="block">Артём</span>
              <span className="block">Волков</span>
            </a>
            <nav className="flex items-center gap-2 sm:gap-3" aria-label="Разделы">
              <a href="#work" className={`hidden sm:inline-flex ${PILL_BASE_W}`}>
                Портфолио
              </a>
              <a href="#services" className={`hidden md:inline-flex ${PILL_BASE_W}`}>
                Съёмки
              </a>
              <a href="#about" className={`hidden md:inline-flex ${PILL_BASE_W}`}>
                О себе
              </a>
              <a href="#contact" className={PILL_FILLED_W}>
                Связаться
              </a>
            </nav>
          </div>
        </header>

        {/* Имя — крупно по нижнему краю */}
        <div className="absolute inset-x-0 bottom-0 z-10">
          <div className={`${WRAP} pb-10 sm:pb-16`}>
            <span className="text-[13px] uppercase tracking-[0.2em] text-white/85">
              Фотограф · портрет и истории
            </span>
            <h1
              className="mt-3 text-white"
              style={{
                fontWeight: 400,
                fontSize: "clamp(3.6rem, 13vw, 11rem)",
                letterSpacing: "-0.04em",
                lineHeight: 0.88,
              }}
            >
              <span className="block">Артём</span>
              <span className="block">Волков</span>
            </h1>
          </div>
        </div>
      </section>

      {/* ── Вступление ── */}
      <section className={`${WRAP} py-16 sm:py-24`}>
        <Reveal>
          <p className="max-w-[620px] text-[20px] leading-[1.4] tracking-[-0.01em] sm:text-[23px]">
            Снимаю людей и то, что между ними: взгляд, прикосновение, свет из окна.
            Без постановки — только настоящие моменты, в которых виден человек.
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
          <span className="text-[14px] text-[#8c8c8c]">01 — 04</span>
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

      {/* ── Манифест: инвертированная чёрная полоса ── */}
      <section className="bg-black text-white">
        <div className={`${WRAP} py-20 sm:py-32`}>
          <Reveal>
            <span className="text-[14px] uppercase tracking-[0.1em]" style={{ color: RED }}>
              Подход
            </span>
            <h2
              style={{ fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 0.98 }}
              className="mt-5 max-w-[16ch] text-[40px] sm:text-[72px]"
            >
              Снимаю не лица, а то, что за ними.
            </h2>
            <p className="mt-8 max-w-[52ch] text-[18px] leading-[1.5] text-white/70">
              Хороший кадр случается, когда человек забывает про камеру. Поэтому я не
              командую «улыбнитесь» — я жду. Разговариваю, гуляю, ловлю свет и паузу
              между словами. То, что остаётся, и есть портрет.
            </p>
            <a href="#about" className={`mt-10 inline-flex ${PILL_BASE_W}`}>
              Как я работаю
            </a>
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
            <Frame id="about" />
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
                Фотограф из Москвы. Снимаю людей с 2015 года: портреты, пары, семьи и
                те тихие моменты, ради которых стоит остановить время.
              </p>
              <p>
                Верю, что хорошая фотография не приукрашивает человека, а помогает его
                разглядеть. Снимаю на плёнку и цифру, обрабатываю сам, держу серию
                цельной — от первого кадра до печати.
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
