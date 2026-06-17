import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { createParticleScene, type ParticleScene } from "./particles";
import { clamp, magneticOffset, pluralRu } from "./lib";

/* ──────────────────────────────────────────────────────────────────────────
   Шаблон «Портфолио моушн/3D-дизайнера» (portfolio-01)
   Полноэкранный самодостаточный лендинг. Живой WebGL-герой (частицы реагируют
   на курсор), шоурил в ядре, сетка кейсов с морфингом карточки в полный экран
   (motion layoutId), «жидкий» интерфейс: кастомный курсор, магнитные кнопки,
   reveal-анимации, скролл-параллакс. Тёмная база + акценты лайм/фиолет.
   Без внешних API, без localStorage. Уважает prefers-reduced-motion.
   Текст и кейсы — осмысленные плейсхолдеры, меняются в одном месте (DATA ниже).
   ────────────────────────────────────────────────────────────────────────── */

const LIME = "#c6ff00";
const VIOLET = "#b9a8ff";
const INK = "#07070a";

const EASE = [0.16, 1, 0.3, 1] as const;

// Снимок на момент загрузки — намеренно: WebGL-движку нужно значение при
// создании сцены. Реактивные компоненты дополнительно используют useReducedMotion().
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const isTouch =
  typeof window !== "undefined" &&
  window.matchMedia("(hover: none), (pointer: coarse)").matches;

/* ── Данные портфолио (всё заменяется здесь) ─────────────────────────────── */

interface Project {
  id: string;
  title: string;
  role: string;
  year: string;
  blurb: string;
  tags: string[];
  /** Два цвета для генеративного градиента-обложки. */
  hue: [string, string];
}

const PROJECTS: Project[] = [
  {
    id: "nebula",
    title: "NEBULA",
    role: "Art Direction · 3D · Houdini",
    year: "2025",
    blurb:
      "Открывающий фильм для конференции по генеративному дизайну: облака частиц собираются в логотип и рассыпаются обратно в туман.",
    tags: ["Houdini", "Redshift", "Sound Design"],
    hue: ["#c6ff00", "#1b6b3a"],
  },
  {
    id: "liquid-chrome",
    title: "LIQUID CHROME",
    role: "Motion · Look Dev",
    year: "2025",
    blurb:
      "Серия лупов для запуска парфюма: жидкий металл стекает по невидимой геометрии, отражая несуществующий город.",
    tags: ["Cinema 4D", "Octane", "Compositing"],
    hue: ["#b9a8ff", "#3a2a7a"],
  },
  {
    id: "field",
    title: "FIELD",
    role: "Realtime · WebGL · TouchDesigner",
    year: "2024",
    blurb:
      "Интерактивная инсталляция в фойе студии: поле из 80 000 частиц следует за движением зрителя в реальном времени.",
    tags: ["TouchDesigner", "GLSL", "Kinect"],
    hue: ["#5ad1ff", "#0d3b66"],
  },
  {
    id: "paper-physics",
    title: "PAPER PHYSICS",
    role: "Direction · Simulation",
    year: "2024",
    blurb:
      "Рекламный ролик банка: бумажные купюры складываются в оригами-город по законам тканевой симуляции.",
    tags: ["Houdini Vellum", "Mantra", "Edit"],
    hue: ["#ffd66b", "#7a4a12"],
  },
  {
    id: "afterglow",
    title: "AFTERGLOW",
    role: "Title Design · 3D Type",
    year: "2023",
    blurb:
      "Титры короткометражки: объёмная типографика плавится и застывает в такт саундтреку, оставляя световые следы.",
    tags: ["Blender", "EEVEE", "Type"],
    hue: ["#ff8db3", "#6b1b3a"],
  },
];

const NAV = [
  { label: "Работы", href: "works" },
  { label: "Шоурил", href: "reel" },
  { label: "Обо мне", href: "about" },
  { label: "Контакт", href: "contact" },
];

/* ── Утилита плавного скролла к секции ───────────────────────────────────── */

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
}

/* ── Доступность модалок: захват/возврат фокуса, Tab-trap, Escape, лок скролла ─ */

function useDialogA11y(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    const prevFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      node
        ? Array.from(
            node.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => el.getClientRects().length > 0)
        : [];
    // фокус внутрь диалога (на первый фокусируемый, иначе на контейнер)
    (focusables()[0] ?? node)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const f = focusables();
        if (f.length === 0) {
          e.preventDefault();
          node?.focus();
          return;
        }
        const idx = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && idx <= 0) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && idx === f.length - 1) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocused?.focus?.(); // вернуть фокус на карточку-триггер
    };
  }, [onClose]);
  return ref;
}

/* ── Кастомный курсор (десктоп, без touch / reduced-motion) ──────────────── */

function CustomCursor() {
  const dotX = useMotionValue(-100);
  const dotY = useMotionValue(-100);
  const ringX = useSpring(dotX, { stiffness: 320, damping: 28, mass: 0.6 });
  const ringY = useSpring(dotY, { stiffness: 320, damping: 28, mass: 0.6 });
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      dotX.set(e.clientX);
      dotY.set(e.clientY);
      const t = e.target as Element | null;
      setHovering(!!t?.closest("a, button, [data-hover]"));
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, [dotX, dotY]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100] hidden md:block mix-blend-difference">
      <motion.div
        className="absolute rounded-full bg-white"
        style={{ x: dotX, y: dotY, width: 6, height: 6, marginLeft: -3, marginTop: -3 }}
      />
      <motion.div
        className="absolute rounded-full border border-white"
        style={{ x: ringX, y: ringY }}
        animate={{
          width: hovering ? 56 : 34,
          height: hovering ? 56 : 34,
          marginLeft: hovering ? -28 : -17,
          marginTop: hovering ? -28 : -17,
          opacity: hovering ? 0.9 : 0.5,
        }}
        transition={{ duration: 0.25, ease: EASE }}
      />
    </div>
  );
}

/* ── Магнитная кнопка ─────────────────────────────────────────────────────── */

function Magnetic({
  children,
  className = "",
  strength = 0.4,
  as = "button",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
  as?: "button" | "a" | "div";
} & Record<string, any>) {
  const ref = useRef<any>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.5 });
  const reduce = useReducedMotion();

  const onMove = (e: ReactPointerEvent) => {
    if (reduce || isTouch) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const o = magneticOffset(e.clientX, e.clientY, r, strength);
    x.set(o.x);
    y.set(o.y);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  // any здесь намеренно: полиморфный тег (button/a/div) с произвольными
  // пропсами (href/onClick) не выражается строго без тяжёлых дженериков.
  const Comp: any = motion[as];
  return (
    <Comp
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ x: sx, y: sy }}
      className={className}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/* ── Reveal: плавное появление при входе в кадр ───────────────────────────── */

function Reveal({
  children,
  className = "",
  delay = 0,
  y = 28,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ── WebGL-герой: облако частиц, реагирующее на курсор ────────────────────── */

function ParticleHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ParticleScene | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const count =
      typeof window !== "undefined" && window.innerWidth < 768 ? 2600 : 6200;
    const scene = createParticleScene(canvas, {
      count,
      reducedMotion: prefersReducedMotion,
    });
    if (!scene) {
      setFailed(true);
      return;
    }
    sceneRef.current = scene;

    // курсор → NDC (-1..1, y вверх)
    const onPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
      scene.setPointer(clamp(nx, -1.4, 1.4), clamp(ny, -1.4, 1.4));
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    // пауза цикла, когда герой ушёл с экрана (батарея)
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        ([entry]) => scene.setActive(entry.isIntersecting),
        { threshold: 0.05 },
      );
      io.observe(canvas);
    }

    return () => {
      window.removeEventListener("pointermove", onPointer);
      io?.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ touchAction: "pan-y" }}
        aria-hidden="true"
      />
      {failed && (
        // фолбэк без WebGL — статичная градиентная аура
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 55% at 50% 42%, rgba(198,255,0,0.18), transparent 70%), radial-gradient(45% 45% at 65% 60%, rgba(185,168,255,0.16), transparent 70%)",
          }}
        />
      )}
    </>
  );
}

/* ── Генеративная обложка проекта (CSS, без картинок) ─────────────────────── */

function ProjectArt({ hue, active }: { hue: [string, string]; active: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${hue[0]}, ${hue[1]})` }}
      />
      <motion.div
        className="absolute -inset-1/4 rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle, ${hue[0]}, transparent 60%)`, opacity: 0.55 }}
        animate={reduce ? undefined : { x: active ? 40 : 0, y: active ? -30 : 0, scale: active ? 1.25 : 1 }}
        transition={{ duration: 1.2, ease: EASE }}
      />
      {/* мягкая «плёночная» зернистость + затемнение снизу для читаемости */}
      <div className="absolute inset-0 mix-blend-overlay opacity-30 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.6),transparent_50%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
    </div>
  );
}

/* ── Карточка проекта ─────────────────────────────────────────────────────── */

function ProjectCard({
  project,
  index,
  featured = false,
  onOpen,
}: {
  project: Project;
  index: number;
  featured?: boolean;
  onOpen: (p: Project) => void;
}) {
  const [hover, setHover] = useState(false);
  const reduce = useReducedMotion();
  return (
    <Reveal delay={(index % 2) * 0.08}>
      <motion.button
        type="button"
        data-hover
        onClick={() => onOpen(project)}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        whileHover={reduce ? undefined : { y: -6 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="group relative block w-full overflow-hidden rounded-3xl border border-white/10 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6ff00]"
        aria-label={`Открыть кейс «${project.title}»`}
      >
        <motion.div
          layoutId={`art-${project.id}`}
          className={`relative ${featured ? "aspect-[4/3] sm:aspect-[21/9]" : "aspect-[4/5] sm:aspect-[16/11]"}`}
          style={{ borderRadius: 24 }}
        >
          <ProjectArt hue={project.hue} active={hover} />
        </motion.div>

        {/* подпись поверх обложки */}
        <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/80">
              {project.year}
            </span>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 text-white transition-colors duration-300 group-hover:bg-white group-hover:text-black"
              aria-hidden="true"
            >
              ↗
            </span>
          </div>
          <div>
            <motion.h3
              layoutId={`title-${project.id}`}
              className="font-display text-3xl sm:text-4xl font-semibold leading-none text-white"
              style={{ textShadow: "0 2px 24px rgba(0,0,0,0.35)" }}
            >
              {project.title}
            </motion.h3>
            <p className="mt-2 text-sm text-white/85">{project.role}</p>
          </div>
        </div>
      </motion.button>
    </Reveal>
  );
}

/* ── Полноэкранный кейс (морфинг из карточки) ─────────────────────────────── */

function ProjectCase({ project, onClose }: { project: Project; onClose: () => void }) {
  const dialogRef = useDialogA11y(onClose);

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[90] overflow-y-auto outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={`Кейс ${project.title}`}
    >
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        onClick={onClose}
      />

      <div className="relative mx-auto min-h-full max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        <motion.div
          layoutId={`art-${project.id}`}
          className="relative h-[42vh] sm:h-[56vh] w-full overflow-hidden"
          style={{ borderRadius: 28 }}
        >
          <ProjectArt hue={project.hue} active />
          <div className="absolute inset-0 flex items-end p-6 sm:p-10">
            <motion.h2
              layoutId={`title-${project.id}`}
              className="font-display text-5xl sm:text-7xl font-semibold leading-[0.95] text-white"
              style={{ textShadow: "0 2px 30px rgba(0,0,0,0.4)" }}
            >
              {project.title}
            </motion.h2>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
          className="relative mt-8 grid grid-cols-1 gap-8 md:grid-cols-3"
        >
          <div className="md:col-span-2">
            <p className="text-xl sm:text-2xl leading-relaxed text-white/90">{project.blurb}</p>
            {/* плейсхолдеры под кадры кейса */}
            <div className="mt-8 grid grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="aspect-video overflow-hidden rounded-2xl border border-white/10"
                  style={{
                    background: `linear-gradient(${120 + i * 40}deg, ${project.hue[0]}22, ${project.hue[1]}55)`,
                  }}
                />
              ))}
            </div>
          </div>
          <aside className="space-y-6 text-sm">
            <div>
              <div className="text-white/45 uppercase tracking-[0.18em] text-[11px]">Роль</div>
              <div className="mt-1 text-white/90">{project.role}</div>
            </div>
            <div>
              <div className="text-white/45 uppercase tracking-[0.18em] text-[11px]">Год</div>
              <div className="mt-1 text-white/90">{project.year}</div>
            </div>
            <div>
              <div className="text-white/45 uppercase tracking-[0.18em] text-[11px]">Инструменты</div>
              <ul className="mt-2 flex flex-wrap gap-2">
                {project.tags.map((t) => (
                  <li key={t} className="rounded-full border border-white/15 px-3 py-1 text-white/80">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </motion.div>
      </div>

      <motion.button
        type="button"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        data-hover
        className="fixed right-4 top-4 z-[95] flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white backdrop-blur-md hover:bg-white hover:text-black transition-colors"
        aria-label="Закрыть кейс"
      >
        ✕
      </motion.button>
    </div>
  );
}

/* ── Секция «Работы» ──────────────────────────────────────────────────────── */

function Works({ onOpen }: { onOpen: (p: Project) => void }) {
  return (
    <section id="works" className="relative mx-auto max-w-7xl px-5 sm:px-8 py-24 sm:py-32">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-4xl sm:text-6xl font-semibold tracking-tight text-white">
            Избранные
            <br />
            <span className="text-white/40">работы</span>
          </h2>
          <span className="hidden sm:block text-sm text-white/40">
            {PROJECTS.length} {pluralRu(PROJECTS.length, ["проект", "проекта", "проектов"])}
          </span>
        </div>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
        {PROJECTS.map((p, i) => (
          <div key={p.id} className={i === 0 ? "sm:col-span-2" : ""}>
            <ProjectCard project={p} index={i} featured={i === 0} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Секция «Шоурил» ──────────────────────────────────────────────────────── */

function ReelModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialogA11y(onClose);
  const reduce = useReducedMotion();
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Шоурил"
    >
      <motion.div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div layoutId="reel-art" className="relative aspect-video w-full max-w-5xl overflow-hidden" style={{ borderRadius: 24 }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${INK}, #14122a 60%, #0a1a12)` }} />
        <motion.div
          className="absolute -inset-1/3 blur-3xl"
          style={{ background: `conic-gradient(from 0deg, ${LIME}, ${VIOLET}, #5ad1ff, ${LIME})`, opacity: 0.4 }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 26, ease: "linear", repeat: Infinity }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-xl sm:text-2xl text-white/80">Здесь будет видео-шоурил</span>
        </div>
      </motion.div>
      <button
        type="button"
        onClick={onClose}
        data-hover
        className="absolute right-4 top-4 z-[95] flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white backdrop-blur-md hover:bg-white hover:text-black transition-colors"
        aria-label="Закрыть шоурил"
      >
        ✕
      </button>
    </div>
  );
}

function Reel() {
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  return (
    <section id="reel" className="relative mx-auto max-w-7xl px-5 sm:px-8 py-24 sm:py-32">
      <Reveal>
        <button
          type="button"
          data-hover
          onClick={() => setOpen(true)}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
          className="group relative block w-full overflow-hidden rounded-[2rem] border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6ff00]"
          aria-label="Открыть шоурил"
        >
          <motion.div layoutId="reel-art" className="relative aspect-[16/10] sm:aspect-[21/9]" style={{ borderRadius: 32 }}>
            {/* живая генеративная подложка — оживает при наведении */}
            <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${INK}, #14122a 60%, #0a1a12)` }} />
            <motion.div
              className="absolute -inset-1/3 blur-3xl"
              style={{ background: `conic-gradient(from 0deg, ${LIME}, ${VIOLET}, #5ad1ff, ${LIME})`, opacity: 0.35 }}
              animate={reduce ? undefined : { rotate: 360, scale: hover ? 1.15 : 1 }}
              transition={{
                rotate: { duration: 26, ease: "linear", repeat: Infinity },
                scale: { duration: 1, ease: EASE },
              }}
            />
            <div className="absolute inset-0 bg-black/30" />

            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
              <span className="text-[11px] uppercase tracking-[0.35em] text-white/70">Showreel 2025 · 02:14</span>
              <motion.span
                className="flex h-20 w-20 sm:h-28 sm:w-28 items-center justify-center rounded-full border border-white/40 text-white backdrop-blur-sm"
                animate={reduce ? undefined : { scale: hover ? 1.12 : 1, backgroundColor: hover ? LIME : "rgba(255,255,255,0)", color: hover ? "#000" : "#fff" }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <span className="ml-1 text-2xl">▶</span>
              </motion.span>
              <span className="font-display text-2xl sm:text-4xl font-medium text-white">Смотреть шоурил</span>
            </div>
          </motion.div>
        </button>
      </Reveal>

      <AnimatePresence>
        {open && <ReelModal onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </section>
  );
}

/* ── Секция «Обо мне» ─────────────────────────────────────────────────────── */

function About() {
  const stats = [
    { v: "9+", l: "лет в моушне" },
    { v: "120+", l: "проектов" },
    { v: "14", l: "наград" },
  ];
  return (
    <section id="about" className="relative mx-auto max-w-7xl px-5 sm:px-8 py-24 sm:py-32">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-7">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#c6ff00]">Обо мне</p>
            <p className="mt-6 font-display text-2xl sm:text-4xl font-medium leading-[1.25] text-white">
              Я превращаю абстрактные идеи в движение. Работаю на стыке 3D, симуляции и кода —
              там, где у каждого кадра своя физика, а интерфейс ощущается живым материалом.
            </p>
          </Reveal>
        </div>
        <div className="md:col-span-5 md:pt-2">
          <Reveal delay={0.1}>
            <p className="text-base leading-relaxed text-white/65">
              От рекламных роликов и титров до интерактивных инсталляций и realtime-графики.
              Houdini, Cinema 4D, Blender, TouchDesigner и WebGL — инструменты, но язык один:
              движение, которому веришь.
            </p>
            <dl className="mt-10 grid grid-cols-3 gap-4">
              {stats.map((s) => (
                <div key={s.l}>
                  <dt className="font-display text-4xl sm:text-5xl font-semibold text-white">{s.v}</dt>
                  <dd className="mt-1 text-xs text-white/50">{s.l}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── Контакт / футер ──────────────────────────────────────────────────────── */

function Contact() {
  return (
    <section id="contact" className="relative mx-auto max-w-7xl px-5 sm:px-8 pt-24 sm:pt-32 pb-16">
      <Reveal>
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Контакт</p>
        <h2 className="mt-6 font-display text-[clamp(2.5rem,9vw,7rem)] font-semibold leading-[0.92] tracking-tight text-white">
          Сделаем
          <br />
          <span className="text-[#c6ff00]">движение</span> вместе
        </h2>
      </Reveal>

      <div className="mt-12 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <Magnetic
          as="a"
          href="mailto:hello@alexmoroz.studio"
          data-hover
          className="inline-flex items-center gap-3 rounded-full bg-[#c6ff00] px-8 py-4 text-lg font-medium text-black hover:bg-white transition-colors"
        >
          hello@alexmoroz.studio
          <span aria-hidden="true">→</span>
        </Magnetic>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
          {["Instagram", "Behance", "Vimeo", "LinkedIn"].map((s) => (
            <a key={s} href="#" data-hover className="hover:text-white transition-colors">
              {s}
            </a>
          ))}
        </div>
      </div>

      <div className="mt-20 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/40">© 2025 Alex Moroz. Шаблон портфолио для WebIK.</p>
        <Link
          to="/templates"
          data-hover
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          ← Все шаблоны WebIK
        </Link>
      </div>
    </section>
  );
}

/* ── Главная страница шаблона ─────────────────────────────────────────────── */

export default function PortfolioLanding() {
  const [active, setActive] = useState<Project | null>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const heroTextY = useTransform(scrollYProgress, [0, 0.18], ["0%", "-40%"]);
  const heroTextOpacity = useTransform(scrollYProgress, [0, 0.14], [1, 0]);

  const open = useCallback((p: Project) => setActive(p), []);
  const close = useCallback(() => setActive(null), []);

  const enableCursor = useMemo(() => !isTouch && !prefersReducedMotion, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#07070a] text-white antialiased selection:bg-[#c6ff00] selection:text-black [font-feature-settings:'ss01']">
      {enableCursor && <CustomCursor />}

      {/* индикатор прокрутки */}
      <motion.div
        className="fixed inset-x-0 top-0 z-[80] h-0.5 origin-left bg-[#c6ff00]"
        style={{ scaleX: progress }}
        aria-hidden="true"
      />

      {/* живой фон нижних секций — мягкая дрейфующая аура */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <motion.div
          className="absolute left-[10%] top-[40%] h-[40vmax] w-[40vmax] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(198,255,0,0.10), transparent 60%)" }}
          animate={reduce ? undefined : { x: [0, 80, -40, 0], y: [0, -60, 40, 0] }}
          transition={{ duration: 32, ease: "easeInOut", repeat: Infinity }}
        />
        <motion.div
          className="absolute right-[5%] top-[120%] h-[45vmax] w-[45vmax] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(185,168,255,0.12), transparent 60%)" }}
          animate={reduce ? undefined : { x: [0, -60, 30, 0], y: [0, 50, -30, 0] }}
          transition={{ duration: 38, ease: "easeInOut", repeat: Infinity }}
        />
      </div>

      {/* верхняя панель: имя слева, быстрый доступ справа (всегда виден) */}
      <header className="fixed inset-x-0 top-0 z-[70] flex items-center justify-between px-5 sm:px-8 py-4">
        <a href="#top" data-hover className="font-display text-sm font-semibold tracking-wide">
          ALEX MOROZ<span className="text-[#c6ff00]">.</span>
        </a>
        <nav className="hidden md:flex items-center gap-7 text-sm text-white/70">
          {NAV.map((n) => (
            <button
              key={n.href}
              type="button"
              data-hover
              onClick={() => scrollToId(n.href)}
              className="hover:text-white transition-colors"
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-hover
            onClick={() => scrollToId("reel")}
            className="hidden sm:inline-flex rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 hover:bg-white hover:text-black transition-colors"
          >
            Reel
          </button>
          <button
            type="button"
            data-hover
            onClick={() => scrollToId("contact")}
            className="rounded-full bg-[#c6ff00] px-4 py-2 text-xs font-medium text-black hover:bg-white transition-colors"
          >
            Contact
          </button>
        </div>
      </header>

      {/* ── ГЕРОЙ ─────────────────────────────────────────────────────────── */}
      <section id="top" className="relative h-[100svh] w-full overflow-hidden">
        <ParticleHero />
        {/* виньетка для читаемости текста */}
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_50%,transparent_40%,rgba(7,7,10,0.7))]" />

        <motion.div
          className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center"
          style={reduce ? undefined : { y: heroTextY, opacity: heroTextOpacity }}
        >
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
            className="text-[11px] uppercase tracking-[0.4em] text-white/70"
          >
            Motion & 3D Designer · Berlin
          </motion.p>
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.2 }}
            className="mt-5 font-display font-semibold leading-[0.86] tracking-tight text-[clamp(3rem,15vw,11rem)]"
          >
            ALEX
            <br />
            MOROZ
          </motion.h1>
          <motion.p
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease: EASE, delay: 0.5 }}
            className="mt-6 max-w-md text-sm sm:text-base text-white/65"
          >
            Превращаю идеи в движение: 3D, симуляция и реальная физика как родной язык.
          </motion.p>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.65 }}
            className="mt-9 flex flex-col sm:flex-row items-center gap-3"
          >
            <Magnetic
              as="button"
              data-hover
              onClick={() => scrollToId("works")}
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-medium text-black hover:bg-[#c6ff00] transition-colors"
            >
              Смотреть работы
              <span aria-hidden="true">↓</span>
            </Magnetic>
            <Magnetic
              as="button"
              data-hover
              onClick={() => scrollToId("reel")}
              strength={0.3}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-sm text-white/90 hover:bg-white/10 transition-colors"
            >
              ▶ Шоурил
            </Magnetic>
          </motion.div>
        </motion.div>

        {/* подсказка прокрутки */}
        {!reduce && (
          <motion.div
            aria-hidden="true"
            className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-xs text-white/50"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
          >
            scroll
          </motion.div>
        )}
      </section>

      {/* ── СЕКЦИИ ─────────────────────────────────────────────────────────── */}
      <main className="relative z-10">
        <Works onOpen={open} />
        <Reel />
        <About />
        <Contact />
      </main>

      {/* морфинг карточки в полноэкранный кейс */}
      <AnimatePresence>
        {active && <ProjectCase key={active.id} project={active} onClose={close} />}
      </AnimatePresence>
    </div>
  );
}
