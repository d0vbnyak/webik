import { useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

type Segment = { label: string; color: string };

const SEGMENTS: Segment[] = [
  { label: "5%", color: "#c7b9ff" },
  { label: "промокод", color: "#ffd6a5" },
  { label: "10%", color: "#a5d8ff" },
  { label: "0%", color: "#ffadad" },
  { label: "15%", color: "#caffbf" },
  { label: "бонус", color: "#fdffb6" },
  { label: "7%", color: "#c7b9ff" },
  { label: "20%", color: "#a5d8ff" },
];

const N = SEGMENTS.length;
const STEP = 360 / N;
const R = 90;
const CX = 100;
const CY = 100;

/** Точка на окружности под углом deg (0° сверху, по часовой) */
function point(deg: number, radius: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

export default function FortuneWheel() {
  const reduce = useReducedMotion();
  const gid = useId();
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState<string | null>(null);
  // индекс выигрышного сегмента — единый источник истины для подписи приза
  const [target, setTarget] = useState<number | null>(null);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setPrize(null);

    // случайный сегмент + несколько полных оборотов
    const win = Math.floor(Math.random() * N);
    setTarget(win);
    const turns = 4 + Math.floor(Math.random() * 3);
    // указатель сверху → центр сегмента win должен оказаться вверху
    const centerOffset = win * STEP + STEP / 2;
    const jitter = (Math.random() - 0.5) * (STEP * 0.5);
    const next =
      Math.ceil(angle / 360) * 360 + turns * 360 - centerOffset - jitter;

    setAngle(next);

    if (reduce) {
      setSpinning(false);
      setPrize(SEGMENTS[win].label);
    }
  };

  const onDone = () => {
    if (!spinning) return;
    setSpinning(false);
    if (target !== null) setPrize(SEGMENTS[target].label);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
      <div className="relative w-full max-w-[200px] shrink-0 pt-3">
        {/* Стрелка-указатель сверху */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 z-10">
          <div
            className="h-0 w-0"
            style={{
              borderLeft: "9px solid transparent",
              borderRight: "9px solid transparent",
              borderTop: "16px solid #1a1a1a",
            }}
          />
        </div>

        <motion.svg
          viewBox="0 0 200 200"
          className="aspect-square h-auto w-full drop-shadow-sm"
          animate={{ rotate: angle }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 4.2, ease: [0.16, 1, 0.3, 1] }
          }
          onAnimationComplete={onDone}
          style={{ originX: 0.5, originY: 0.5 }}
        >
          {SEGMENTS.map((seg, i) => {
            const start = i * STEP;
            const end = start + STEP;
            const p1 = point(start, R);
            const p2 = point(end, R);
            const mid = point(start + STEP / 2, R * 0.62);
            const d = `M ${CX} ${CY} L ${p1.x} ${p1.y} A ${R} ${R} 0 0 1 ${p2.x} ${p2.y} Z`;
            return (
              <g key={`${gid}-seg-${i}`}>
                <path d={d} fill={seg.color} stroke="#ffffff" strokeWidth={2} />
                <text
                  x={mid.x}
                  y={mid.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${start + STEP / 2} ${mid.x} ${mid.y})`}
                  className="font-display"
                  fontSize="10"
                  fontWeight="600"
                  fill="#1a1a1a"
                >
                  {seg.label}
                </text>
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#1a1a1a" strokeOpacity={0.08} strokeWidth={2} />
          <circle cx={CX} cy={CY} r={14} fill="#1a1a1a" />
          <circle cx={CX} cy={CY} r={5} fill="#9fff00" />
        </motion.svg>
      </div>

      <div className="w-full sm:flex-1 space-y-3 text-center sm:text-left">
        <div className="font-display font-medium text-lg text-[#1a1a1a] leading-tight">
          колесо фортуны
        </div>
        <p className="text-[11px] text-[#1a1a1a]/50 leading-snug">
          крутаните и заберите скидку на запуск лендинга
        </p>

        <button
          type="button"
          onClick={spin}
          disabled={spinning}
          className="rounded-full bg-[#1a1a1a] px-5 py-2.5 text-sm lowercase text-white transition-opacity disabled:opacity-40 hover:opacity-90"
        >
          {spinning ? "крутится…" : "крутить"}
        </button>

        <div className="min-h-[40px]">
          {prize !== null && (
            <motion.div
              key={prize}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-black/[0.05] shadow-sm px-3 py-2"
            >
              <span className="text-base">🎉</span>
              <span className="text-xs text-[#1a1a1a]/70">
                вам выпало:{" "}
                <b className="font-display text-[#1a1a1a]">{prize}</b>
              </span>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
