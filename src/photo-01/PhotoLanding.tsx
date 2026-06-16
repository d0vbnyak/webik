import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";

/* ──────────────────────────────────────────────────────────────────────────
   Шаблон «Фотограф» (photo-01) — ГОРИЗОНТАЛЬНАЯ ЛЕНТА
   Весь сайт — горизонтальный ряд полноэкранных панелей со «залипанием» (snap).
   Десктоп: колесо мыши шагает вбок по экранам. Тач: свайп вбок. Плюс стрелки,
   клавиатура, прогресс-бар и счётчик секций. Эффекты: зум фото активной панели
   (Ken Burns), плавное появление текста.
   Стиль — редакционный брутализм (чёрный/белый/#e8e8e8, красный только на
   метках-рубриках), шрифт Helvetica/Arial.
   ────────────────────────────────────────────────────────────────────────── */

const INK = "#000000";
const PAPER = "#ffffff";
const NEWSPRINT = "#e8e8e8";
const RED = "#ff0000";
const FONT = '"Helvetica Neue", Helvetica, Arial, "Inter", sans-serif';

/* ──────────────────────────────────────────────────────────────────────────
   ФОТОГРАФИИ. Заменить кадр — в ОДНУ строку: меняете путь в `src`
   (файл кладёте в public/photo-01/). ASSET_V — версия кеша (меняйте при замене).
   ────────────────────────────────────────────────────────────────────────── */
type Photo = { src: string | null; label: string; ratio: string };

const ASSET_V = "1";

const PHOTOS = {
  // Коллажи во весь экран в начале (hero)
  heroWide: { src: `/photo-01/hero-wide.jpg?v=${ASSET_V}`, label: "Коллаж работ", ratio: "16 / 9" },
  heroTall: { src: `/photo-01/hero-tall.jpg?v=${ASSET_V}`, label: "Коллаж работ", ratio: "9 / 16" },
  intro: { src: `/photo-01/intro.jpg?v=${ASSET_V}`, label: "Плёночная камера на столе", ratio: "16 / 9" },
  // Работы — вертикальные 9:16 (мобайл) и широкие 16:9 (десктоп), во весь экран
  flight: { src: `/photo-01/flight.jpg?v=${ASSET_V}`, label: "Полёт", ratio: "9 / 16" },
  greenery: { src: `/photo-01/greenery.jpg?v=${ASSET_V}`, label: "Среди зелени", ratio: "9 / 16" },
  character: { src: `/photo-01/character.jpg?v=${ASSET_V}`, label: "Шляпа", ratio: "9 / 16" },
  rain: { src: `/photo-01/rain.jpg?v=${ASSET_V}`, label: "Город в каплях", ratio: "9 / 16" },
  gaze: { src: `/photo-01/gaze.jpg?v=${ASSET_V}`, label: "Взгляд", ratio: "9 / 16" },
  evening: { src: `/photo-01/evening.jpg?v=${ASSET_V}`, label: "Вечер за книгой", ratio: "9 / 16" },
  flightWide: { src: `/photo-01/flight-wide.jpg?v=${ASSET_V}`, label: "Полёт", ratio: "16 / 9" },
  greeneryWide: { src: `/photo-01/greenery-wide.jpg?v=${ASSET_V}`, label: "Среди зелени", ratio: "16 / 9" },
  characterWide: { src: `/photo-01/character-wide.jpg?v=${ASSET_V}`, label: "Шляпа", ratio: "16 / 9" },
  rainWide: { src: `/photo-01/rain-wide.jpg?v=${ASSET_V}`, label: "Город в каплях", ratio: "16 / 9" },
  gazeWide: { src: `/photo-01/gaze-wide.jpg?v=${ASSET_V}`, label: "Взгляд", ratio: "16 / 9" },
  eveningWide: { src: `/photo-01/evening-wide.jpg?v=${ASSET_V}`, label: "Вечер за книгой", ratio: "16 / 9" },
  // О фотографе
  about: { src: `/photo-01/about.jpg?v=${ASSET_V}`, label: "Портрет фотографа", ratio: "4 / 5" },
} satisfies Record<string, Photo>;

type PhotoId = keyof typeof PHOTOS;

const reduceMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Фото, заполняющее родителя (родитель — relative overflow-hidden). Активная
   панель: лёгкий зум 1.08 → 1.0 (Ken Burns). Если src нет — серая заглушка. */
function PhotoFill({
  id,
  active = true,
  className = "",
  position,
}: {
  id: PhotoId;
  active?: boolean;
  className?: string;
  position?: string;
}) {
  const p = PHOTOS[id];
  if (!p.src) return <div className={`absolute inset-0 ${className}`} style={{ backgroundColor: NEWSPRINT }} />;
  return (
    <motion.img
      src={p.src}
      alt={p.label}
      decoding="async"
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
      style={position ? { objectPosition: position } : undefined}
      initial={false}
      animate={{ scale: reduceMotion ? 1 : active ? 1 : 1.08 }}
      transition={{ duration: reduceMotion ? 0 : 1.5, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}

/* Плавное появление текста при входе панели в кадр. Уважает reduce-motion. */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 26 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Внутренний контейнер контента панели
const WRAP = "mx-auto w-full max-w-[1200px] px-6 sm:px-10 lg:px-16";

const PILL_BASE =
  "items-center rounded-none border border-black px-4 py-2 text-[15px] sm:text-base transition-colors hover:bg-black hover:text-white";
const PILL_GHOST = `inline-flex ${PILL_BASE}`;
const PILL_BASE_W =
  "items-center rounded-none border border-white/80 px-4 py-2 text-[15px] sm:text-base text-white transition-colors hover:bg-white hover:text-black";

/* Данные секций. desc — короткое описание прямо на фото. id — вертикальное фото
   (мобайл), wide — широкое 16:9 (десктоп); если wide нет, на десктопе берётся id. */
const WORKS: { id: PhotoId; wide?: PhotoId; cat: string; title: string; desc: string; year: string }[] = [
  { id: "flight", wide: "flightWide", cat: "Движение", title: "Полёт", desc: "Свет, прыжок и доля секунды между ними.", year: "2025" },
  { id: "greenery", wide: "greeneryWide", cat: "Портрет", title: "Среди зелени", desc: "Портрет в оранжерее, утренний свет сквозь листья.", year: "2025" },
  { id: "character", wide: "characterWide", cat: "Характер", title: "Шляпа", desc: "Фактуры, руки и жест — портрет без лица.", year: "2024" },
  { id: "rain", wide: "rainWide", cat: "История", title: "Город в каплях", desc: "Силуэт за мокрым стеклом и огни ночного города.", year: "2024" },
  { id: "gaze", wide: "gazeWide", cat: "Портрет", title: "Взгляд", desc: "Тёплый контровый свет и дым в кадре.", year: "2024" },
  { id: "evening", wide: "eveningWide", cat: "История", title: "Вечер за книгой", desc: "Тихий час при свете настольной лампы.", year: "2023" },
];

const SERVICES = [
  { title: "Портретная съёмка", desc: "Студия или город, 1–2 часа, 20–30 обработанных кадров", price: "от 12 000 ₽" },
  { title: "Love-story и пары", desc: "Съёмка-прогулка вашей истории — дома или на улицах города", price: "от 18 000 ₽" },
  { title: "Семейная съёмка", desc: "Тёплые кадры о близких, без постановки и натянутых улыбок", price: "от 16 000 ₽" },
  { title: "Репортаж и события", desc: "Свадьбы, концерты, городские истории", price: "договорная" },
];

const CONTACTS = [
  { label: "hello@artemvolkov.ru", href: "mailto:hello@artemvolkov.ru" },
  { label: "Telegram", href: "https://t.me/" },
  { label: "Behance", href: "https://www.behance.net/" },
];

// Индексы панелей (для навигации) и подписи для счётчика
const NAV = { work: 2, services: 9, about: 10, contact: 11 };
const SECTIONS = [
  "Главная",
  "О съёмке",
  "Полёт",
  "Среди зелени",
  "Шляпа",
  "Город в каплях",
  "Взгляд",
  "Вечер за книгой",
  "Подход",
  "Съёмки",
  "О фотографе",
  "Контакты",
];
const COUNT = SECTIONS.length;

// Полноэкранная панель ленты
function Panel({
  children,
  bg = PAPER,
  dark = false,
  className = "",
}: {
  children: ReactNode;
  bg?: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`relative h-[100svh] w-screen flex-none snap-start snap-always overflow-hidden ${className}`}
      style={{ backgroundColor: bg, color: dark ? "#ffffff" : INK }}
    >
      {children}
    </section>
  );
}

const two = (n: number) => String(n).padStart(2, "0");

export default function PhotoLanding() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Перейти к панели i (плавно)
  const goto = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(COUNT - 1, i));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
  }, []);

  // Колесо мыши → шаг вбок с залипанием (десктоп). Горизонтальный жест трекпада
  // отдаём нативной прокрутке. Слушатель non-passive — чтобы preventDefault сработал.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let locked = false;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // горизонтальный свайп — нативно
      e.preventDefault();
      if (locked || Math.abs(e.deltaY) < 4) return;
      locked = true;
      const cur = Math.round(el.scrollLeft / el.clientWidth);
      goto(cur + (e.deltaY > 0 ? 1 : -1));
      window.setTimeout(() => {
        locked = false;
      }, 650);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [goto]);

  // Прокрутка → счётчик + прогресс
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth || 1;
        const max = el.scrollWidth - w;
        setProgress(max > 0 ? el.scrollLeft / max : 0);
        setIndex(Math.round(el.scrollLeft / w));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Клавиатура: стрелки / PageUp-Down / Home / End
  useEffect(() => {
    const cur = () => {
      const el = trackRef.current;
      return el ? Math.round(el.scrollLeft / el.clientWidth) : 0;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goto(cur() + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goto(cur() - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goto(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goto(COUNT - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goto]);

  // При ресайзе держим выравнивание по текущей панели
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onResize = () =>
      el.scrollTo({ left: Math.round(el.scrollLeft / el.clientWidth) * el.clientWidth });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      id="top"
      style={{ fontFamily: FONT }}
      className="relative h-[100svh] w-screen overflow-hidden bg-black antialiased selection:bg-black selection:text-white"
    >
      {/* ── ЛЕНТА панелей ── */}
      <div
        ref={trackRef}
        className="flex h-[100svh] w-screen snap-x snap-mandatory overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* 0 — Hero: полноэкранный коллаж */}
        <Panel bg="#000000" dark>
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
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.8) 100%)",
            }}
          />
          {/* Имя — сверху слева; фамилия выезжает вертикально вниз из-под имени */}
          <div className="absolute inset-x-0 top-0 z-10">
            <div className={`${WRAP} pt-20 sm:pt-24`}>
              <span className="text-[13px] uppercase tracking-[0.2em] text-white/85">
                Фотограф · портрет и истории
              </span>
              <h1
                className="mt-3 text-white"
                style={{ fontWeight: 400, fontSize: "clamp(3.4rem, 12vw, 9rem)", letterSpacing: "-0.04em", lineHeight: 0.9 }}
              >
                Артём
              </h1>
              {/* Волков — вертикально, выезжает вниз из-под имени, по левому краю (вровень с «А») */}
              <div className="mt-1 overflow-hidden">
                <motion.span
                  className="inline-block text-white"
                  style={{
                    writingMode: "vertical-rl",
                    fontWeight: 400,
                    fontSize: "clamp(2.2rem, 9vh, 6rem)",
                    letterSpacing: "-0.04em",
                    lineHeight: 0.9,
                  }}
                  initial={reduceMotion ? false : { y: "-100%" }}
                  animate={reduceMotion ? undefined : { y: "0%" }}
                  transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  Волков
                </motion.span>
              </div>
            </div>
          </div>
          {/* Подсказка прокрутки — снизу слева */}
          <div className="absolute inset-x-0 bottom-0 z-10">
            <div className={`${WRAP} pb-10 sm:pb-14`}>
              <motion.div
                className="inline-flex items-center gap-2 text-[13px] uppercase tracking-[0.18em] text-white/80"
                animate={reduceMotion ? undefined : { x: [0, 10, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                Листайте вбок <span className="text-base">→</span>
              </motion.div>
            </div>
          </div>
        </Panel>

        {/* 1 — Вступление: фото камеры во весь экран, текст поверх */}
        <Panel bg="#000000" dark>
          <img
            src={PHOTOS.intro.src!}
            alt={PHOTOS.intro.label}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: "30% 50%" }}
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to right, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.45) 44%, rgba(0,0,0,0.05) 80%)" }}
          />
          <div className={`${WRAP} relative z-10 flex h-full flex-col justify-center`}>
            <Reveal>
              <span className="text-[14px] uppercase tracking-[0.16em]" style={{ color: RED }}>
                Вступление
              </span>
              <p
                className="mt-6 max-w-[20ch] text-[clamp(2rem,5.5vw,4.5rem)] text-white"
                style={{ fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 1.02 }}
              >
                Снимаю людей и то, что между ними.
              </p>
              <p className="mt-7 max-w-[46ch] text-[18px] leading-[1.5] text-white/75 sm:text-[20px]">
                Взгляд, прикосновение, свет из окна. Без постановки — только настоящие
                моменты, в которых виден человек.
              </p>
              <button onClick={() => goto(NAV.work)} className={`mt-9 inline-flex ${PILL_BASE_W}`}>
                Смотреть работы →
              </button>
            </Reveal>
          </div>
        </Panel>

        {/* 2–7 — Работы: фото во весь экран (мобайл 9:16, десктоп 16:9), описание поверх фото */}
        {WORKS.map((w, i) => {
          const active = index === 2 + i;
          return (
            <Panel key={w.id} bg="#000000" dark>
              <PhotoFill id={w.id} active={active} className="lg:hidden" />
              <PhotoFill
                id={w.wide ?? w.id}
                active={active}
                className="hidden lg:block"
                position={w.wide ? undefined : "50% 22%"}
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 34%, rgba(0,0,0,0) 62%)" }}
              />
              <div className="absolute inset-x-0 bottom-0">
                <div className={`${WRAP} pb-16 sm:pb-20`}>
                  <Reveal>
                    <span className="text-[13px] uppercase tracking-[0.16em]" style={{ color: RED }}>{w.cat}</span>
                    <h2 className="mt-3 text-white text-[clamp(2.6rem,8vw,5rem)]" style={{ fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 0.96 }}>
                      {w.title}
                    </h2>
                    <p className="mt-3 max-w-[42ch] text-[16px] leading-[1.45] text-white/85 sm:text-[18px]">{w.desc}</p>
                    <div className="mt-4 flex items-center gap-3 text-[13px] text-white/60">
                      <span>{w.year}</span>
                      <span className="h-px w-8 bg-white/30" />
                      <span>{two(i + 1)} / {two(WORKS.length)}</span>
                    </div>
                  </Reveal>
                </div>
              </div>
            </Panel>
          );
        })}

        {/* 6 — Манифест */}
        <Panel bg="#000000" dark>
          <div className={`${WRAP} flex h-full flex-col justify-center`}>
            <Reveal>
              <span className="text-[14px] uppercase tracking-[0.1em]" style={{ color: RED }}>
                Подход
              </span>
              <h2
                className="mt-5 max-w-[16ch] text-[clamp(2.4rem,7vw,6rem)]"
                style={{ fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 0.98 }}
              >
                Снимаю не лица, а то, что за ними.
              </h2>
              <p className="mt-8 max-w-[54ch] text-[18px] leading-[1.5] text-white/70 sm:text-[20px]">
                Хороший кадр случается, когда человек забывает про камеру. Поэтому я не
                командую «улыбнитесь» — я жду. Разговариваю, гуляю, ловлю свет и паузу
                между словами. То, что остаётся, и есть портрет.
              </p>
              <button onClick={() => goto(NAV.about)} className={`mt-10 inline-flex ${PILL_BASE_W}`}>
                Как я работаю
              </button>
            </Reveal>
          </div>
        </Panel>

        {/* 7 — Съёмки */}
        <Panel bg={NEWSPRINT}>
          <div className={`${WRAP} flex h-full flex-col justify-center`}>
            <Reveal>
              <h2
                className="text-[clamp(2.2rem,5vw,3.5rem)]"
                style={{ fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1 }}
              >
                Съёмки
              </h2>
            </Reveal>
            <div className="mt-8 sm:mt-10">
              {SERVICES.map((s, i) => (
                <Reveal key={s.title} delay={(i % 2) * 0.06}>
                  <div className="flex flex-col gap-1 border-t border-black py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:py-5">
                    <h3 style={{ fontWeight: 600, letterSpacing: "-0.01em" }} className="text-[20px] leading-[1.15] sm:w-1/3 sm:text-[23px]">
                      {s.title}
                    </h3>
                    <p className="text-[15px] leading-[1.4] text-black/65 sm:flex-1 sm:text-[16px]">{s.desc}</p>
                    <span className="text-[17px] sm:text-right sm:text-[18px]">{s.price}</span>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal>
              <button onClick={() => goto(NAV.contact)} className={`mt-9 ${PILL_GHOST}`}>
                Обсудить съёмку
              </button>
            </Reveal>
          </div>
        </Panel>

        {/* 8 — О фотографе */}
        <Panel>
          <div className="flex h-full w-full flex-col lg:flex-row">
            <div className="relative h-[48%] w-full overflow-hidden lg:h-full lg:w-[45%]">
              <PhotoFill id="about" active={index === NAV.about} />
            </div>
            <div className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-10 lg:px-14">
              <Reveal>
                <span className="text-[14px] uppercase tracking-[0.1em]" style={{ color: RED }}>
                  О фотографе
                </span>
                <h2
                  className="mt-4 text-[clamp(2.2rem,4.5vw,3.5rem)]"
                  style={{ fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 0.95 }}
                >
                  Артём Волков
                </h2>
                <div className="mt-5 max-w-[52ch] space-y-3 text-[16px] leading-[1.45] text-black/80 sm:text-[18px]">
                  <p>
                    Фотограф из Москвы. Снимаю людей с 2015 года: портреты, пары, семьи и
                    те тихие моменты, ради которых стоит остановить время.
                  </p>
                  <p>
                    Верю, что хорошая фотография не приукрашивает человека, а помогает его
                    разглядеть. Снимаю на плёнку и цифру, обрабатываю сам.
                  </p>
                </div>
                <div className="mt-8 flex gap-10">
                  {[
                    { n: "10 лет", l: "в фотографии" },
                    { n: "200+", l: "съёмок" },
                    { n: "6", l: "выставок" },
                  ].map((s) => (
                    <div key={s.l}>
                      <div style={{ fontWeight: 600 }} className="text-[26px] leading-none">{s.n}</div>
                      <div className="mt-1.5 text-[13px] text-black/55">{s.l}</div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </Panel>

        {/* 9 — Контакты */}
        <Panel bg="#000000" dark>
          <div className={`${WRAP} flex h-full flex-col justify-center`}>
            <Reveal>
              <h2
                className="text-[clamp(3.5rem,12vw,9rem)]"
                style={{ fontWeight: 400, letterSpacing: "-0.04em", lineHeight: 0.9 }}
              >
                Снимем?
              </h2>
              <p className="mt-6 max-w-[40ch] text-[18px] leading-[1.4] text-white/70 sm:text-[20px]">
                Расскажите про задачу — отвечу в течение дня.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {CONTACTS.map((c) => (
                  <a key={c.label} href={c.href} className={`inline-flex ${PILL_BASE_W}`}>
                    {c.label}
                  </a>
                ))}
              </div>
            </Reveal>
            <div className="absolute inset-x-0 bottom-8 sm:bottom-10">
              <div className={`${WRAP} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-white/15 pt-5 text-[12px] text-white/55`}>
                <Link
                  to="/templates"
                  className="inline-flex items-center gap-1.5 rounded-none border border-white/20 px-3 py-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
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
          </div>
        </Panel>
      </div>

      {/* ── Постоянный интерфейс поверх ленты (auto-контраст через mix-blend) ── */}
      {/* Стрелки (десктоп) */}
      <button
        aria-label="Назад"
        onClick={() => goto(index - 1)}
        className={`fixed left-3 top-1/2 z-40 hidden -translate-y-1/2 text-3xl text-white mix-blend-difference transition-opacity sm:block ${
          index === 0 ? "pointer-events-none opacity-0" : "opacity-80 hover:opacity-100"
        }`}
      >
        ‹
      </button>
      <button
        aria-label="Вперёд"
        onClick={() => goto(index + 1)}
        className={`fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 text-3xl text-white mix-blend-difference transition-opacity sm:block ${
          index === COUNT - 1 ? "pointer-events-none opacity-0" : "opacity-80 hover:opacity-100"
        }`}
      >
        ›
      </button>

      {/* Счётчик секций */}
      <div className="pointer-events-none fixed bottom-4 right-5 z-40 text-[12px] uppercase tracking-[0.12em] text-white mix-blend-difference">
        <span className="tabular-nums">{two(index + 1)}</span> / {two(COUNT)} · {SECTIONS[index]}
      </div>

      {/* Прогресс-бар */}
      <div className="fixed inset-x-0 bottom-0 z-40 h-[3px] bg-white/10">
        <div className="h-full bg-white mix-blend-difference" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
