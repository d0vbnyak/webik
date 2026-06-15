import { useId, useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

export default function ScrollDrawSVG() {
  const ref = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const gid = `sdg-${rawId.replace(/:/g, "")}`;

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "center 0.4"],
  });

  // прорисовка по мере прокрутки виджета через вьюпорт
  const draw = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const tick = useTransform(scrollYProgress, [0.6, 1], [0, 1]);
  const dot = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div ref={ref} className="relative flex justify-center py-2">
      <svg
        viewBox="0 0 320 150"
        className="w-full max-w-[420px] h-[180px]"
        fill="none"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1a1a1a" />
            <stop offset="1" stopColor="#9fff00" />
          </linearGradient>
        </defs>

        {/* призрачный контур-подложка */}
        <path
          d="M10 110 C 60 60, 90 130, 130 80 S 200 20, 250 70 S 300 30, 312 40"
          stroke="#1a1a1a"
          strokeOpacity="0.08"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* основная кривая-график, рисуется по скроллу */}
        <motion.path
          d="M10 110 C 60 60, 90 130, 130 80 S 200 20, 250 70 S 300 30, 312 40"
          stroke={`url(#${gid})`}
          strokeWidth="3"
          strokeLinecap="round"
          style={{ pathLength: draw }}
        />
        {/* галочка-чек, появляется ближе к концу */}
        <motion.path
          d="M250 120 l 14 14 l 28 -34"
          stroke="#9fff00"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pathLength: tick }}
        />
        {/* точка-курсор, едет по началу кривой */}
        <motion.circle
          cx="10"
          cy="110"
          r="4"
          fill="#1a1a1a"
          style={{ scale: dot, opacity: dot }}
        />
      </svg>

      <span className="absolute bottom-1 left-3 text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
        листайте — линия рисуется
      </span>
    </div>
  );
}
