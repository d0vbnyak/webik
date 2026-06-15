import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "motion/react";

const CONTACT_EMAIL = "hello@webik.ru";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260603_132049_036591b8-6e92-4760-b94c-a7ea6eef315c.mp4";

function EyePill() {
  const reduceMotion = useReducedMotion();

  return (
    <span className="relative w-[24px] md:w-[42px] lg:w-[62px] h-[24px] md:h-[28px] lg:h-[34px] inline-flex items-center justify-center align-middle mx-1 md:mx-2">
      {/* Точка — всегда на месте */}
      <span className="w-2 h-2 rounded-full bg-[#1a1a1a]" />
      {/* Овал — ездит по горизонтали и отталкивается от точки:
          easeIn к краю (разгон), easeOut после разворота (отскок).
          При prefers-reduced-motion — остаётся неподвижным. */}
      <motion.span
        animate={reduceMotion ? { x: "0%" } : { x: ["0%", "36%", "0%", "-36%", "0%"] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                duration: 2.8,
                repeat: Infinity,
                ease: ["easeIn", "easeOut", "easeIn", "easeOut"],
              }
        }
        className="absolute inset-0 border-[2px] border-[#1a1a1a] rounded-full"
      />
    </span>
  );
}

export default function Hero() {
  const [task, setTask] = useState("");
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Уважаем prefers-reduced-motion: не автозапускаем фоновое видео и ставим на паузу
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reduceMotion) {
      video.pause();
    } else {
      // play() возвращает промис; игнорируем возможный AbortError при размонтировании
      void video.play().catch(() => {});
    }
  }, [reduceMotion]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = task.trim();
    if (!text) return;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      "Заявка с сайта WebIK",
    )}&body=${encodeURIComponent(text)}`;
  };

  return (
    <section className="relative min-h-[100svh] sm:min-h-[140svh] w-full flex flex-col items-center justify-start overflow-hidden bg-bg-base">
      {/* Фоновое видео */}
      <div className="absolute top-[34vh] sm:top-[20vh] left-0 w-full h-[76vh] sm:h-[120vh] z-0 pointer-events-none">
        <video
          ref={videoRef}
          autoPlay={!reduceMotion}
          loop={!reduceMotion}
          muted
          playsInline
          className="w-full h-full object-cover opacity-100"
          src={VIDEO_URL}
        />
        <div className="absolute top-0 left-0 w-full h-24 sm:h-32 bg-gradient-to-b from-bg-base to-transparent"></div>
      </div>

      {/* Контент */}
      <div className="max-w-7xl w-full mx-auto px-8 md:px-16 lg:px-20 relative z-10 grid grid-cols-12 gap-x-4 md:gap-x-8 pt-32 sm:pt-40 md:pt-44">
        <div className="col-span-12 md:col-span-10 md:col-start-2">
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="font-display font-medium tracking-tight text-[2rem] leading-[1.14] sm:text-5xl lg:text-6xl xl:text-[64px]"
          >
            <span className="text-[#1a1a1a]">WebIK создаёт </span>
            <span className="text-[#8e8e8e]">сайты,</span>
            <br className="hidden sm:inline" />
            <span className="text-[#8e8e8e]"> ботов и AI-решения, которые</span>
            <br className="hidden sm:inline" />
            <span className="text-[#8e8e8e]">
              {" "}
              двигают <EyePill /> ваш бизнес.
            </span>
          </motion.h1>

          {/* Поисковая капсула */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="mt-8 md:mt-12 max-w-[420px]"
          >
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-[6px] border border-black/[0.05] p-1 pl-4 flex items-center shadow-sm"
            >
              <input
                type="text"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                aria-label="Опишите вашу задачу"
                placeholder="Опишите вашу задачу..."
                className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Отправить"
                className="bg-[#1a1a1a] text-white w-9 h-9 rounded-full relative shrink-0"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="absolute inset-0 m-auto w-4 h-4"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </form>
          </motion.div>
        </div>
      </div>

      {/* Якорь — переключатель языка, середина справа */}
      <div className="absolute right-3 md:right-6 top-[68%] sm:top-1/2 -translate-y-1/2 z-20">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Английская версия скоро"
          className="flex items-center gap-1.5 rounded-full bg-white/30 border border-white/50 backdrop-blur-md px-3.5 py-2 text-[11px] tracking-wide text-[#1a1a1a] shadow-sm cursor-not-allowed"
        >
          <span className="font-medium">ru</span>
          <span className="text-[#1a1a1a]/40">—</span>
          <span className="text-[#1a1a1a]/50">en</span>
        </button>
      </div>

      {/* Якорь — низ слева */}
      <div className="absolute bottom-5 left-5 md:left-8 z-20 text-[11px] tracking-wide text-[#1a1a1a]/70">
        2026
      </div>

      {/* Якорь — низ справа */}
      <div className="absolute bottom-5 right-5 md:right-8 z-20 text-[11px] tracking-wide text-[#1a1a1a]/70">
        веб-студия и AI-решения
      </div>
    </section>
  );
}
