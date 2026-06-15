import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Photo = { id: number; from: string; to: string; title: string };

const PHOTOS: Photo[] = [
  { id: 1, from: "#c7b9ff", to: "#a5d8ff", title: "сирень" },
  { id: 2, from: "#ffd6a5", to: "#ffadad", title: "закат" },
  { id: 3, from: "#caffbf", to: "#9fff00", title: "поле" },
  { id: 4, from: "#a5d8ff", to: "#fdffb6", title: "море" },
  { id: 5, from: "#ffadad", to: "#c7b9ff", title: "сумерки" },
  { id: 6, from: "#fdffb6", to: "#caffbf", title: "рассвет" },
];

const grad = (p: Photo) => `linear-gradient(135deg, ${p.from} 0%, ${p.to} 100%)`;

export default function LightboxGallery() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  const show = (i: number, el: HTMLButtonElement) => {
    triggerRef.current = el;
    setOpen(((i % PHOTOS.length) + PHOTOS.length) % PHOTOS.length);
  };
  const next = () => setOpen((i) => (i === null ? null : (i + 1) % PHOTOS.length));
  const prev = () => setOpen((i) => (i === null ? null : (i - 1 + PHOTOS.length) % PHOTOS.length));
  const close = () => setOpen(null);

  // Клавиатура, перенос фокуса в модалку и focus-trap, пока лайтбокс открыт
  useEffect(() => {
    if (open === null) {
      if (wasOpen.current) {
        triggerRef.current?.focus();
        wasOpen.current = false;
      }
      return;
    }
    wasOpen.current = true;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Tab") {
        const nodes = overlayRef.current?.querySelectorAll<HTMLElement>("button");
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative h-[240px] w-full overflow-hidden rounded-xl border border-black/[0.05] bg-white p-3 shadow-sm">
      <div className="grid h-full grid-cols-3 grid-rows-2 gap-2.5">
        {PHOTOS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            aria-label={`Открыть фото: ${p.title}`}
            onClick={(e) => show(i, e.currentTarget)}
            className="group relative overflow-hidden rounded-lg outline-none ring-brand-green focus-visible:ring-2"
            style={{ background: grad(p) }}
          >
            <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
            <span className="absolute bottom-1 left-1.5 text-[10px] lowercase tracking-wide text-[#1a1a1a]/55">
              {p.title}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {open !== null && (
          <motion.div
            key="overlay"
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Просмотр фото: ${PHOTOS[open].title}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
          >
            {/* крупное фото со свайпом */}
            <motion.div
              key={open}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              drag={reduce ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) next();
                else if (info.offset.x > 60) prev();
              }}
              onClick={(e) => e.stopPropagation()}
              className="relative aspect-[300/176] h-auto w-[88%] max-w-[300px] cursor-grab touch-pan-y overflow-hidden rounded-xl shadow-2xl active:cursor-grabbing"
              style={{ background: grad(PHOTOS[open]) }}
            >
              <span className="absolute bottom-2 left-3 font-display text-sm font-medium text-[#1a1a1a]/70">
                {PHOTOS[open].title}
              </span>
              <span className="absolute right-3 top-2 text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
                {open + 1} / {PHOTOS.length}
              </span>
            </motion.div>

            {/* стрелки */}
            <button
              type="button"
              aria-label="Предыдущее фото"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-2 top-1/2 z-30 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#1a1a1a] shadow-md outline-none ring-brand-green focus-visible:ring-2"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Следующее фото"
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-2 top-1/2 z-30 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#1a1a1a] shadow-md outline-none ring-brand-green focus-visible:ring-2"
            >
              ›
            </button>

            {/* закрыть */}
            <button
              type="button"
              ref={closeRef}
              aria-label="Закрыть"
              onClick={(e) => { e.stopPropagation(); close(); }}
              className="absolute right-2 top-2 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[13px] text-[#1a1a1a] shadow-md outline-none ring-brand-green focus-visible:ring-2"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
