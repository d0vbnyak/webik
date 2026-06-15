import { useRef, useEffect, useState } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence, useScroll, useMotionValue, useMotionValueEvent } from "motion/react";

// Наливание по скроллу = перемотка кадров; keyframe на каждом кадре (GOP=1) — мгновенный seek.
// Десктоп: горизонтальное 1080p. Мобайл: ВЕРТИКАЛЬНОЕ 720×1280 (на весь экран телефона) —
// лёгкий 720p кадр телефон успевает рисовать резко прямо во время прокрутки.
// ?v — версия ассета: меняем при замене файла, чтобы телефон/браузер не показывал кеш
const ASSET_V = "2";
const VIDEO_URL = `/coffe-01/kettle_smooth.mp4?v=${ASSET_V}`;
const VIDEO_MOBILE_URL = `/coffe-01/kettle_mobile.mp4?v=${ASSET_V}`;
const POSTER_URL = `/coffe-01/poster.jpg?v=${ASSET_V}`;
const POSTER_MOBILE_URL = `/coffe-01/poster_mobile.jpg?v=${ASSET_V}`;

/* Палитра кофейни */
const COFFEE = {
  espresso: "#1c1410",
  bean: "#2b1d14",
  cream: "#f4ece0",
  caramel: "#c98a4b",
  mocha: "#7a5235",
};

// Меню по категориям — раскрываются интерактивными аккордеонами
const MENU_CATEGORIES = [
  {
    id: "espresso",
    name: "Эспрессо",
    note: "на основе эспрессо",
    items: [
      { name: "Эспрессо", desc: "Классический шот, плотная крема", price: "180 ₽" },
      { name: "Доппио", desc: "Двойной эспрессо", price: "220 ₽" },
      { name: "Ристретто", desc: "Концентрированный короткий шот", price: "180 ₽" },
      { name: "Лунго", desc: "Удлинённая мягкая экстракция", price: "200 ₽" },
      { name: "Американо", desc: "Эспрессо с горячей водой", price: "200 ₽" },
      { name: "Эспрессо макиато", desc: "Шот с каплей молочной пены", price: "210 ₽" },
      { name: "Кортадо", desc: "Эспрессо и тёплое молоко 1:1", price: "230 ₽" },
      { name: "Эспрессо романо", desc: "Шот с цедрой лимона", price: "210 ₽" },
    ],
  },
  {
    id: "milk",
    name: "На молоке",
    note: "мягкие и сливочные",
    items: [
      { name: "Капучино", desc: "Бархатная молочная пенка", price: "260 ₽" },
      { name: "Латте", desc: "Мягкий, с большим количеством молока", price: "280 ₽" },
      { name: "Флэт уайт", desc: "Двойной шот, тонкая микропенка", price: "300 ₽" },
      { name: "Латте макиато", desc: "Слоистый, молоко с эспрессо", price: "290 ₽" },
      { name: "Мокачино", desc: "Латте с тёмным шоколадом", price: "320 ₽" },
      { name: "Раф классический", desc: "Сливки, ваниль, тростниковый сахар", price: "320 ₽" },
      { name: "Раф карамель", desc: "Сливки и солёная карамель", price: "340 ₽" },
      { name: "Раф лавандовый", desc: "Сливки с цветочной лавандой", price: "350 ₽" },
      { name: "Бреве", desc: "Эспрессо на взбитых сливках", price: "330 ₽" },
      { name: "Кофе по-венски", desc: "Эспрессо со взбитыми сливками", price: "300 ₽" },
    ],
  },
  {
    id: "filter",
    name: "Альтернатива и холодный",
    note: "фильтр и колд брю",
    items: [
      { name: "Фильтр V60", desc: "Ручная заварка, чистый вкус", price: "320 ₽" },
      { name: "Кемекс", desc: "Мягкий фильтр на компанию", price: "360 ₽" },
      { name: "Аэропресс", desc: "Насыщенный, плотное тело", price: "320 ₽" },
      { name: "Колд брю", desc: "16 часов холодной экстракции", price: "330 ₽" },
      { name: "Колд брю с тоником", desc: "Освежающий, с тоником и льдом", price: "360 ₽" },
      { name: "Эспрессо-тоник", desc: "Эспрессо, тоник, лёд", price: "340 ₽" },
      { name: "Батч-брю", desc: "Фильтр-кофе дня", price: "250 ₽" },
    ],
  },
  {
    id: "signature",
    name: "Авторские и сезонные",
    note: "наш характер",
    items: [
      { name: "Бамбл", desc: "Эспрессо, апельсиновый фреш, лёд", price: "350 ₽" },
      { name: "Айс латте", desc: "Латте со льдом", price: "300 ₽" },
      { name: "Айс капучино", desc: "Капучино со льдом", price: "300 ₽" },
      { name: "Латте на кокосовом", desc: "Безлактозный, мягкий кокос", price: "320 ₽" },
      { name: "Тыквенный латте", desc: "Латте со специями pumpkin spice", price: "360 ₽" },
      { name: "Мятный мокко", desc: "Тёмный шоколад и свежая мята", price: "350 ₽" },
    ],
  },
  {
    id: "tea",
    name: "Чай",
    note: "листовой, в чайнике",
    items: [
      { name: "Чёрный (Ассам)", desc: "Насыщенный классический", price: "220 ₽" },
      { name: "Зелёный (Сенча)", desc: "Лёгкий, травянистый", price: "220 ₽" },
      { name: "Улун", desc: "Сливочный, молочный", price: "260 ₽" },
      { name: "Свежая мята", desc: "Листовая мята с мёдом", price: "240 ₽" },
      { name: "Каркаде", desc: "Гибискус, ягодная кислинка", price: "220 ₽" },
      { name: "Масала", desc: "Чёрный чай со специями на молоке", price: "290 ₽" },
    ],
  },
  {
    id: "snacks",
    name: "Закуски к кофе и чаю",
    note: "свежая выпечка и десерты",
    items: [
      { name: "Круассан", desc: "Слоёный, на сливочном масле", price: "180 ₽" },
      { name: "Чизкейк Нью-Йорк", desc: "Кремовый, на песочной основе", price: "320 ₽" },
      { name: "Морковный кейк", desc: "Со сливочно-сырным кремом", price: "300 ₽" },
      { name: "Банановый хлеб", desc: "С грецким орехом", price: "220 ₽" },
      { name: "Овсяное печенье", desc: "Домашнее, с изюмом", price: "120 ₽" },
      { name: "Сырники", desc: "С ягодным соусом", price: "280 ₽" },
    ],
  },
];

/* Повествовательные блоки hero, которые сменяются при прокрутке поверх видео */
const STORY = [
  {
    eyebrow: "Наша история",
    title: "Всё началось в 2014",
    body: "BREW. появился из простого убеждения: хороший кофе не должен быть сложным. С 2014 года мы держим один адрес, один стандарт и одно обещание — каждая чашка сделана с полным вниманием.",
  },
  {
    eyebrow: "Ремесло",
    title: "Медленно, точно, вручную",
    body: "Мы завариваем пуровер за пуровером — контролируя температуру воды до градуса и время экстракции до секунды. Никакой спешки: каждая чашка требует своего времени.",
  },
  {
    eyebrow: "Зерно",
    title: "Арабика с фермерских хозяйств",
    body: "Мы работаем только с арабикой от небольших фермеров, обжариваем малыми партиями и используем фильтрованную воду с выверенной минерализацией. Оборудование здесь служит зерну, а не наоборот.",
  },
];

const INVITE = {
  eyebrow: "Приходите",
  title: "Здесь всегда есть место",
  body: "Заходите утром, в середине дня или когда нужна пауза. Мы сварим вам кофе, который стоит того, чтобы остановиться и выпить его не торопясь.",
};

// Секция-экран рассказа. По умолчанию текст по верху (портрет телефона + низкий ландшафт —
// чтобы не налезать на шапку/плашку). Центрируем ТОЛЬКО когда экран и широкий, и высокий (десктоп).
const HERO_SECTION =
  "min-h-screen flex flex-col justify-start pt-28 " +
  "[@media(min-width:640px)_and_(min-height:640px)]:justify-center " +
  "[@media(min-width:640px)_and_(min-height:640px)]:pt-0";

/** Бейдж WebIK — стоит поверх правого нижнего угла видео и закрывает водяной знак.
    Только десктоп: на мобиле кадр смещён и водяной знак уходит за правый край, бейдж не нужен */
function WebIKBadge() {
  return (
    <div className="hidden sm:block absolute bottom-6 right-6 z-30">
      {/* Плотная стеклянная плашка — непрозрачная в зоне водяного знака */}
      <div className="flex items-center gap-2 rounded-full bg-[#15100c]/85 backdrop-blur-md border border-white/10 px-3.5 py-2 shadow-lg shadow-black/30">
        <span className="w-2 h-2 rounded-full bg-brand-green shadow-[0_0_8px_2px_rgba(159,255,0,0.5)]" />
        <span className="text-[11px] sm:text-xs tracking-wide text-white/90">
          Сделано в <span className="font-semibold text-white">WebIK</span>
        </span>
      </div>
    </div>
  );
}

/** Hero: видео-фон с наливанием по скроллу + текст, прокручивающийся поверх */
function ScrollPourHero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Мобильное навигационное меню (бургер). Видно только на <md.
  const [navOpen, setNavOpen] = useState(false);
  // Целевой прогресс 0..1 от скролла; время видео плавно догоняет его в rAF-цикле
  const targetProgress = useRef(0);
  // Мобильный режим: узкий экран ИЛИ сенсорное устройство (телефон в ландшафте).
  // Влияет только на preload: на мобиле грузим видео целиком для плавной перемотки.
  const [isMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(
        "(max-width: 639px), (pointer: coarse) and (max-width: 1024px)",
      ).matches,
  );
  // Уважаем системную настройку «уменьшить движение»
  const [reduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Подсказка прокрутки гаснет в начале скролла
  const hintOpacity = useMotionValue(1);

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    targetProgress.current = Math.min(Math.max(p, 0), 1);
  });

  // Запуск/прогрев видео + старт с актуальной позиции скролла
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // например, после F5 в прокрученном состоянии — не начинать с нуля
    targetProgress.current = Math.min(Math.max(scrollYProgress.get(), 0), 1);

    if (reduceMotion) return; // оставляем статичный постер
    // Прогреваем декодер: без хотя бы одного play() Safari и часть мобильных браузеров
    // не перерисовывают кадры при перемотке. Видео muted — play разрешён без жеста.
    const warm = () => {
      v.play()
        .then(() => v.pause())
        .catch(() => {});
    };
    if (v.readyState >= 1) warm();
    else v.addEventListener("loadedmetadata", warm, { once: true });
  }, [reduceMotion, scrollYProgress]);

  // Наливание следует за скроллом перемоткой кадров (десктоп и мобайл одинаково).
  // reduce-motion: перемотку не трогаем — обновляем только подсказку.
  useEffect(() => {
    const scrub = !reduceMotion;
    let raf = 0;
    let current = 0;
    let lastSet = -1;
    const SMOOTH = 0.12; // меньше — плавнее/инертнее, больше — отзывчивее
    const SNAP_EPS = 0.004; // доводчик у цели
    const SEEK_EPS = 0.01; // не перематываем в покое: лишний seek = декод кадра

    const tick = () => {
      const sp = targetProgress.current;

      if (scrub) {
        const v = videoRef.current;
        const dur = v?.duration;
        if (v && dur && !Number.isNaN(dur)) {
          const target = sp * dur;
          const diff = target - current;
          current += Math.abs(diff) < SNAP_EPS ? diff : diff * SMOOTH;
          const t = Math.min(current, dur - 0.05); // не упираемся в самый конец
          if (!v.seeking && Math.abs(t - lastSet) > SEEK_EPS) {
            try {
              v.currentTime = t;
              lastSet = t;
            } catch {
              /* видео ещё не готово к перемотке */
            }
          }
        }
      }

      hintOpacity.set(sp <= 0 ? 1 : sp >= 0.05 ? 0 : 1 - sp / 0.05);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hintOpacity, reduceMotion]);

  // Кнопка «Налить кофе»: плавная авто-прокрутка через весь hero.
  // Скролл сам и наливает видео (перемотка следует за позицией), и прокручивает текст.
  const autoRaf = useRef(0);
  const autoStop = useRef<() => void>(() => {});

  // на размонтировании гасим возможную активную авто-прокрутку
  useEffect(
    () => () => {
      cancelAnimationFrame(autoRaf.current);
      autoStop.current();
    },
    [],
  );

  // Закрытие мобильного меню по Escape
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  const pourCoffee = () => {
    const sec = sectionRef.current;
    if (!sec) return;
    cancelAnimationFrame(autoRaf.current);
    autoStop.current();

    const startY = window.scrollY;
    // bottom через getBoundingClientRect устойчив к появлению позиционированной обёртки
    // (offsetTop меряется от offsetParent, а не от документа)
    const endY = sec.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
    const dist = endY - startY;
    if (dist <= 4) return;

    const duration = 8500; // ~длительность наливания
    const t0 = performance.now();
    const ease = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2; // easeInOutSine

    // любой ручной ввод прерывает авто-прокрутку — пользователь снова у руля
    const stop = () => {
      cancelAnimationFrame(autoRaf.current);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchmove", stop);
      window.removeEventListener("keydown", stop);
      autoStop.current = () => {};
    };
    autoStop.current = stop;
    window.addEventListener("wheel", stop, { passive: true });
    // touchmove (реальный жест скролла), а не touchstart — иначе авто-прокрутку
    // рвёт любое касание экрана, даже без намерения скроллить
    window.addEventListener("touchmove", stop, { passive: true });
    window.addEventListener("keydown", stop);

    const step = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      window.scrollTo(0, startY + dist * ease(p));
      if (p < 1) autoRaf.current = requestAnimationFrame(step);
      else stop();
    };
    autoRaf.current = requestAnimationFrame(step);
  };

  return (
    <div ref={sectionRef} className="relative bg-[#15100c]">
      {/* Прилипающий фон-видео со всеми оверлеями.
          Высота lvh (максимальная): когда мобильный Chrome прячет адресную строку,
          экран становится выше — с svh снизу вылезал бы сплошной фон. lvh перекрывает всегда. */}
      <div className="sticky top-0 h-[100lvh] w-full overflow-hidden">
        <video
          ref={videoRef}
          src={isMobile ? VIDEO_MOBILE_URL : VIDEO_URL}
          poster={isMobile ? POSTER_MOBILE_URL : POSTER_URL}
          muted
          playsInline
          aria-hidden="true"
          preload={isMobile ? "auto" : "metadata"}
          className="absolute inset-0 w-full h-full object-cover object-center sm:object-right-bottom"
        />

        {/* Десктоп: затемнение слева под текст + общий тёплый тон */}
        <div
          className="absolute inset-0 hidden sm:block"
          style={{
            background:
              "linear-gradient(to right, rgba(21,16,12,0.9) 0%, rgba(21,16,12,0.5) 40%, rgba(21,16,12,0) 72%)",
          }}
        />
        <div className="absolute inset-0 hidden sm:block bg-gradient-to-t from-[#15100c]/65 via-transparent to-[#15100c]/30" />
        {/* Мобайл: текст читается на затемнённом верхе, чашка внизу остаётся светлой */}
        <div
          className="absolute inset-x-0 top-0 h-[58%] sm:hidden"
          style={{
            background:
              "linear-gradient(to bottom, rgba(21,16,12,0.96) 0%, rgba(21,16,12,0.7) 45%, rgba(21,16,12,0) 100%)",
          }}
        />
        {/* Угловая виньетка топит водяной знак (правый нижний угол) — только десктоп.
            На мобиле знак уходит за правый край из-за смещённого object-position */}
        <div
          className="hidden sm:block absolute bottom-0 right-0 w-[60%] h-[70%] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 75% at bottom right, rgba(21,16,12,0.97) 0%, rgba(21,16,12,0.92) 42%, rgba(21,16,12,0) 85%)",
          }}
        />

        {/* Бейдж WebIK поверх водяного знака (только десктоп) */}
        <WebIKBadge />
      </div>

      {/* Хром первого экрана — НЕ липкий: виден на первом экране и уезжает при прокрутке,
          поэтому не висит над текстом рассказа и нижними секциями.
          pointer-events-none на слое, auto — на интерактивных элементах */}
      <div className="absolute top-0 left-0 w-full h-[100svh] z-30 pointer-events-none">
        {/* Мини-навбар кофейни */}
        <header className="absolute top-0 left-0 w-full pointer-events-auto">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 h-20 flex items-center justify-between">
            <span className="font-serif text-xl sm:text-2xl tracking-wide" style={{ color: COFFEE.cream }}>
              BREW<span style={{ color: COFFEE.caramel }}>.</span>
            </span>
            <nav
              aria-label="Навигация кофейни"
              className="hidden md:flex items-center gap-8 text-[13px] tracking-wide text-white/80"
            >
              <a href="#menu" className="rounded-sm hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#15100c]">Меню</a>
              <a href="#about" className="rounded-sm hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#15100c]">О нас</a>
              <a href="#contact" className="rounded-sm hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#15100c]">Контакты</a>
            </nav>
            <div className="flex items-center gap-2">
              <a
                href="#contact"
                className="rounded-full px-4 py-2 text-[13px] font-medium text-[#15100c] transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#15100c]"
                style={{ backgroundColor: COFFEE.cream }}
              >
                Забронировать
              </a>
              {/* Бургер: только мобильный (<md), тач-таргет 44×44 */}
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                aria-label="Открыть меню"
                aria-expanded={navOpen}
                aria-controls="coffee-mobile-nav"
                className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-full text-white/90 border border-white/15 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#15100c]"
              >
                <span aria-hidden="true" className="flex flex-col items-center justify-center gap-[5px]">
                  <span className="block w-5 h-px bg-current" />
                  <span className="block w-5 h-px bg-current" />
                  <span className="block w-5 h-px bg-current" />
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Мобильное меню-overlay (бургер). Только <md. Закрытие: фон, ссылка, Escape */}
        <AnimatePresence>
          {navOpen && (
            <motion.div
              id="coffee-mobile-nav"
              className="md:hidden fixed inset-0 z-50 pointer-events-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Затемнённый фон — клик закрывает */}
              <button
                type="button"
                aria-label="Закрыть меню"
                onClick={() => setNavOpen(false)}
                className="absolute inset-0 w-full h-full bg-black/60 backdrop-blur-sm cursor-default"
              />
              {/* Drawer со ссылками */}
              <motion.nav
                aria-label="Мобильная навигация кофейни"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
                className="absolute top-0 right-0 h-full w-[78%] max-w-xs flex flex-col px-6 pt-6 shadow-2xl shadow-black/40 border-l border-white/10"
                style={{ backgroundColor: COFFEE.bean }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-serif text-xl tracking-wide" style={{ color: COFFEE.cream }}>
                    BREW<span style={{ color: COFFEE.caramel }}>.</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setNavOpen(false)}
                    aria-label="Закрыть меню"
                    className="inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-full text-2xl leading-none text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#15100c]"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
                <div className="mt-8 flex flex-col">
                  {[
                    { href: "#menu", label: "Меню" },
                    { href: "#about", label: "О нас" },
                    { href: "#contact", label: "Контакты" },
                  ].map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={() => setNavOpen(false)}
                      className="flex items-center min-h-[44px] py-2 font-serif text-2xl rounded-sm transition-colors hover:text-[#c98a4b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#15100c]"
                      style={{ color: COFFEE.cream }}
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              </motion.nav>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Подсказка прокрутки — гаснет в начале скролла */}
        <motion.div
          aria-hidden="true"
          style={{ opacity: hintOpacity }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] tracking-[0.2em] uppercase text-white/70 flex flex-col items-center gap-2"
        >
          прокрутите
          <span className="w-px h-6 bg-white/40" />
        </motion.div>

        {/* Возврат к шаблонам WebIK — уезжает вместе с первым экраном; с нижних секций
            вернуться можно ссылкой в футере. Слева снизу на мобиле, под шапкой слева на десктопе */}
        <Link
          to="/templates"
          className="pointer-events-auto absolute bottom-4 left-3 [@media(min-width:640px)_and_(min-height:640px)]:bottom-auto [@media(min-width:640px)_and_(min-height:640px)]:top-24 [@media(min-width:640px)_and_(min-height:640px)]:left-4 inline-flex items-center min-h-[40px] rounded-full bg-[#15100c]/85 backdrop-blur-md border border-white/15 px-4 text-[11px] tracking-wide text-white/90 shadow-lg shadow-black/30 hover:bg-[#15100c] transition-colors"
        >
          ← Шаблоны WebIK
        </Link>
      </div>

      {/* Текст рассказа — прокручивается обычным потоком поверх фонового видео.
          На мобиле лёгкая тень текста для читаемости над яркими кадрами (на десктопе есть scrim слева) */}
      <div className="relative z-10 -mt-[100lvh] max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_2px_22px_rgba(0,0,0,0.6)] sm:[text-shadow:none]">
        {/* Приветствие */}
        <section className={HERO_SECTION}>
          <div className="max-w-sm sm:max-w-md lg:max-w-xl pb-28 sm:pb-0">
            <span
              className="inline-block text-[12px] tracking-[0.25em] uppercase mb-5"
              style={{ color: COFFEE.caramel }}
            >
              спешелти-кофейня
            </span>
            <h1
              className="font-serif text-[2.6rem] [@media(min-width:640px)_and_(min-height:640px)]:text-6xl [@media(min-width:1024px)_and_(min-height:640px)]:text-7xl leading-[1.05]"
              style={{ color: COFFEE.cream }}
            >
              Кофе, сваренный
              <br />
              <span className="italic" style={{ color: COFFEE.caramel }}>с любовью</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-white/85 leading-relaxed max-w-md">
              Свежая обжарка каждое утро и ручная заварка. Нажмите «Налить кофе»
              или прокрутите вниз — и мы нальём вам чашку.
            </p>
            {!reduceMotion && (
              <button
                type="button"
                onClick={pourCoffee}
                className="mt-7 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-[#15100c] shadow-lg shadow-black/20 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#15100c]"
                style={{ backgroundColor: COFFEE.caramel }}
              >
                Налить кофе
                <span aria-hidden="true" className="text-base leading-none">↓</span>
              </button>
            )}
          </div>
        </section>

        {/* Рассказ о кофейне */}
        {STORY.map((b) => (
          <section key={b.eyebrow} className={HERO_SECTION}>
            <div className="max-w-sm sm:max-w-md lg:max-w-xl pb-28 sm:pb-0">
              <span
                className="inline-block text-[12px] tracking-[0.25em] uppercase mb-4"
                style={{ color: COFFEE.caramel }}
              >
                {b.eyebrow}
              </span>
              <h2
                className="font-serif text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.08]"
                style={{ color: COFFEE.cream }}
              >
                {b.title}
              </h2>
              <p className="mt-6 text-lg sm:text-xl text-white/80 leading-relaxed">
                {b.body}
              </p>
            </div>
          </section>
        ))}

        {/* Приглашение + CTA */}
        <section className={HERO_SECTION}>
          <div className="max-w-sm sm:max-w-md lg:max-w-xl pb-28 sm:pb-0">
            <span
              className="inline-block text-[12px] tracking-[0.25em] uppercase mb-4"
              style={{ color: COFFEE.caramel }}
            >
              {INVITE.eyebrow}
            </span>
            <h2
              className="font-serif text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.08]"
              style={{ color: COFFEE.cream }}
            >
              {INVITE.title}
            </h2>
            <p className="mt-6 text-lg sm:text-xl text-white/80 leading-relaxed">
              {INVITE.body}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="#menu"
                className="rounded-full px-6 py-3 text-sm font-medium text-[#15100c] transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#15100c]"
                style={{ backgroundColor: COFFEE.caramel }}
              >
                Смотреть меню
              </a>
              <a
                href="#about"
                className="rounded-full px-6 py-3 text-sm font-medium text-white/90 border border-white/25 hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#15100c]"
              >
                О кофейне
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

type MenuCat = (typeof MENU_CATEGORIES)[number];

/** Категория меню — раскрывающийся аккордеон со списком позиций */
function MenuCategory({
  cat,
  open,
  onToggle,
}: {
  cat: MenuCat;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-white/10">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`menu-panel-${cat.id}`}
        className="group w-full flex items-center justify-between gap-4 py-5 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98a4b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2b1d14]"
      >
        <span className="flex items-baseline gap-3">
          <span
            className={`font-serif text-2xl sm:text-3xl transition-colors group-hover:text-[#c98a4b] ${
              open ? "text-[#c98a4b]" : "text-[#f4ece0]"
            }`}
          >
            {cat.name}
          </span>
          <span className="text-[11px] tracking-wide text-white/55">{cat.items.length}</span>
        </span>
        <span className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline text-[12px] text-white/60">{cat.note}</span>
          <motion.span
            aria-hidden="true"
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.25 }}
            className="text-2xl leading-none w-6 text-center group-hover:scale-110"
            style={{ color: COFFEE.caramel }}
          >
            +
          </motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`menu-panel-${cat.id}`}
            role="region"
            aria-label={cat.name}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pb-7 grid sm:grid-cols-2 gap-x-10 gap-y-4">
              {cat.items.map((item) => (
                <div key={item.name}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[15px]" style={{ color: COFFEE.cream }}>
                      {item.name}
                    </span>
                    <span className="flex-1 border-b border-dotted border-white/20" />
                    <span className="text-[13px] font-medium shrink-0" style={{ color: COFFEE.caramel }}>
                      {item.price}
                    </span>
                  </div>
                  <p className="text-[12px] text-white/65 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Секция меню: интерактивные категории, которые открываются и показывают список */
function MenuSection() {
  const [openIds, setOpenIds] = useState<string[]>([MENU_CATEGORIES[0].id]);
  const toggle = (id: string) =>
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <section id="menu" className="py-24 sm:py-32" style={{ backgroundColor: COFFEE.bean }}>
      <div className="max-w-3xl mx-auto px-6 sm:px-10">
        <div className="text-center mb-12 sm:mb-14">
          <span className="text-[12px] tracking-[0.25em] uppercase" style={{ color: COFFEE.caramel }}>
            наше меню
          </span>
          <h2 className="font-serif text-4xl sm:text-5xl mt-4" style={{ color: COFFEE.cream }}>
            Кофе, чай и закуски
          </h2>
          <p className="mt-4 text-[13px] text-white/60">
            Нажмите на категорию, чтобы раскрыть список
          </p>
        </div>

        <div>
          {MENU_CATEGORIES.map((cat) => (
            <MenuCategory
              key={cat.id}
              cat={cat}
              open={openIds.includes(cat.id)}
              onToggle={() => toggle(cat.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function CoffeeLanding() {
  useEffect(() => {
    const prev = document.title;
    document.title = "BREW. — спешелти-кофейня · шаблон WebIK";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="font-sans" style={{ backgroundColor: COFFEE.cream }}>
      <ScrollPourHero />

      {/* О кофейне */}
      <section id="about" className="py-24 sm:py-32" style={{ backgroundColor: COFFEE.cream }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-[12px] tracking-[0.25em] uppercase" style={{ color: COFFEE.caramel }}>
              о нас
            </span>
            <h2 className="font-serif text-4xl sm:text-5xl mt-4 leading-tight" style={{ color: COFFEE.bean }}>
              Каждая чашка — ручная работа
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed" style={{ color: COFFEE.mocha }}>
              Мы обжариваем зерно небольшими партиями и завариваем кофе вручную.
              Никакого конвейера — только внимание к деталям, от выбора фермы
              до температуры воды.
            </p>
            <div className="mt-8 flex gap-10">
              {[
                { n: "12", l: "сортов зерна" },
                { n: "6:30", l: "открываемся" },
                { n: "★ 4.9", l: "рейтинг гостей" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-serif text-2xl" style={{ color: COFFEE.bean }}>{s.n}</div>
                  <div className="text-[12px] mt-1" style={{ color: COFFEE.mocha }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl overflow-hidden aspect-[4/5] shadow-xl shadow-black/10">
            <img
              src="/coffe-01/about.jpg"
              alt="Бариста заваривает кофе в кофейне BREW"
              loading="lazy"
              decoding="async"
              width={768}
              height={960}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Меню — интерактивные категории */}
      <MenuSection />

      {/* Контакты / футер */}
      <section id="contact" className="py-20" style={{ backgroundColor: COFFEE.espresso }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 flex flex-col sm:flex-row sm:items-end justify-between gap-8">
          <div>
            <span className="font-serif text-3xl" style={{ color: COFFEE.cream }}>
              BREW<span style={{ color: COFFEE.caramel }}>.</span>
            </span>
            <p className="mt-4 text-sm text-white/60 max-w-xs leading-relaxed">
              ул. Кофейная, 1 · ежедневно с 6:30 до 22:00 · +7 (900) 000-00-00
            </p>
          </div>
          <a
            href="#contact"
            className="rounded-full px-6 py-3 text-sm font-medium text-[#15100c] self-start transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: COFFEE.caramel }}
          >
            Построить маршрут
          </a>
        </div>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 mt-12 pt-6 border-t border-white/10 flex flex-wrap items-center gap-x-6 gap-y-3 justify-between text-[12px] text-white/55">
          <Link
            to="/templates"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            ← Все шаблоны WebIK
          </Link>
          <span>© 2026 BREW. Шаблон кофейни</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
            Сделано в WebIK
          </span>
        </div>
      </section>
    </div>
  );
}
