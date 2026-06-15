import { useEffect, useId, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

type Period = "week" | "month";

type Point = { label: string; value: number };

const DATA: Record<Period, Point[]> = {
  week: [
    { label: "пн", value: 32 },
    { label: "вт", value: 48 },
    { label: "ср", value: 41 },
    { label: "чт", value: 67 },
    { label: "пт", value: 58 },
    { label: "сб", value: 73 },
    { label: "вс", value: 51 },
  ],
  month: [
    { label: "янв", value: 120 },
    { label: "фев", value: 168 },
    { label: "мар", value: 145 },
    { label: "апр", value: 210 },
    { label: "май", value: 188 },
    { label: "июн", value: 246 },
  ],
};

const TABS: { id: Period; label: string }[] = [
  { id: "week", label: "неделя" },
  { id: "month", label: "месяц" },
];

const W = 460;
const H = 150;
const PAD_X = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

export default function MiniDashboard() {
  const uid = useId();
  const reduce = useReducedMotion();
  const [period, setPeriod] = useState<Period>("week");
  const [hover, setHover] = useState<number | null>(null);

  const data = DATA[period];

  const { max, total, avg, peak } = useMemo(() => {
    const values = data.map((d) => d.value);
    const mx = Math.max(...values);
    const tot = values.reduce((s, v) => s + v, 0);
    return {
      max: mx,
      total: tot,
      avg: Math.round(tot / values.length),
      peak: mx,
    };
  }, [data]);

  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const step = innerW / data.length;
  const barW = step * 0.5;

  const barX = (i: number) => PAD_X + step * i + (step - barW) / 2;
  const barH = (v: number) => (v / max) * innerH;
  const barY = (v: number) => PAD_TOP + innerH - barH(v);

  // на тач тултип закрывается тапом вне графика
  useEffect(() => {
    if (hover === null) return;
    const close = () => setHover(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [hover]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid grid-cols-3 gap-2 sm:flex-1">
          <Metric label="всего" value={total.toLocaleString("ru-RU")} accent />
          <Metric label="в среднем" value={avg.toLocaleString("ru-RU")} />
          <Metric label="пик" value={peak.toLocaleString("ru-RU")} />
        </div>
        <div className="flex gap-1 self-end rounded-full bg-[#1a1a1a]/[0.05] p-0.5 sm:self-auto">
          {TABS.map((t) => {
            const active = t.id === period;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setPeriod(t.id);
                  setHover(null);
                }}
                className={`text-[11px] lowercase rounded-full px-3 py-1.5 transition-colors ${
                  active
                    ? "bg-[#1a1a1a] text-white"
                    : "text-[#1a1a1a]/55 hover:text-[#1a1a1a]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[150px]"
          role="img"
          aria-label="столбчатый график активности"
        >
          {/* базовая линия */}
          <line
            x1={PAD_X}
            y1={PAD_TOP + innerH}
            x2={W - PAD_X}
            y2={PAD_TOP + innerH}
            stroke="#1a1a1a"
            strokeOpacity={0.12}
            strokeWidth={1}
          />
          {data.map((d, i) => {
            const active = hover === i;
            const ratio = barH(d.value) / innerH; // 0..1 целевой scaleY
            return (
              <g key={`${period}-${d.label}`}>
                {/* анимируем scaleY от низа столбца — transform вместо reflow по height/y */}
                <motion.rect
                  x={barX(i)}
                  y={PAD_TOP}
                  width={barW}
                  height={innerH}
                  rx={3}
                  style={{ transformBox: "fill-box", transformOrigin: "bottom" }}
                  initial={reduce ? false : { scaleY: 0 }}
                  animate={{ scaleY: ratio }}
                  transition={{
                    duration: reduce ? 0 : 0.5,
                    delay: reduce ? 0 : i * 0.05,
                    ease: "easeOut",
                  }}
                  fill={active ? "#9fff00" : "#1a1a1a"}
                />
                {/* прозрачная зона на всю высоту столбца — мышь (hover) и тач (тап-тоггл) */}
                <rect
                  x={PAD_X + step * i}
                  y={PAD_TOP}
                  width={step}
                  height={innerH}
                  fill="transparent"
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") setHover(i);
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === "mouse") setHover(null);
                  }}
                  onPointerDown={(e) => {
                    // тап по столбцу тогглит тултип; не даём document-listener'у закрыть его
                    e.stopPropagation();
                    setHover((h) => (h === i ? null : i));
                  }}
                />
                <text
                  x={barX(i) + barW / 2}
                  y={H - 6}
                  textAnchor="middle"
                  className="fill-[#1a1a1a]"
                  fillOpacity={0.4}
                  fontSize={10}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute bg-[#1a1a1a] text-white text-[10px] rounded-md px-2 py-1 -translate-x-1/2 -translate-y-full"
            style={{
              left: `${((barX(hover) + barW / 2) / W) * 100}%`,
              top: `${(barY(data[hover].value) / H) * 100}%`,
            }}
          >
            <span className="font-display">{data[hover].value}</span> заявок
          </div>
        )}
        <span
          id={`${uid}-cap`}
          className="absolute -bottom-1 right-0 text-[10px] lowercase tracking-wide text-[#1a1a1a]/40"
        >
          заявки за период
        </span>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-black/[0.05] shadow-sm px-3 py-2">
      <div className="flex items-center gap-1.5">
        {accent && <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />}
        <span className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
          {label}
        </span>
      </div>
      <div className="font-display font-medium text-lg leading-tight text-[#1a1a1a]">
        {value}
      </div>
    </div>
  );
}
