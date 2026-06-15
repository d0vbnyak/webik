import { useId, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";

type Condition = "clear" | "cloudy" | "rain" | "snow";

type Day = { day: string; cond: Condition; temp: number };

type City = {
  id: string;
  name: string;
  temp: number;
  cond: Condition;
  label: string;
  forecast: Day[];
};

const CONDITION_LABEL: Record<Condition, string> = {
  clear: "ясно",
  cloudy: "облачно",
  rain: "дождь",
  snow: "снег",
};

const CITIES: City[] = [
  {
    id: "msk",
    name: "москва",
    temp: 18,
    cond: "cloudy",
    label: "облачно",
    forecast: [
      { day: "пн", cond: "rain", temp: 15 },
      { day: "вт", cond: "cloudy", temp: 17 },
      { day: "ср", cond: "clear", temp: 21 },
      { day: "чт", cond: "clear", temp: 23 },
      { day: "пт", cond: "rain", temp: 16 },
    ],
  },
  {
    id: "spb",
    name: "питер",
    temp: 12,
    cond: "rain",
    label: "дождь",
    forecast: [
      { day: "пн", cond: "rain", temp: 11 },
      { day: "вт", cond: "rain", temp: 12 },
      { day: "ср", cond: "cloudy", temp: 14 },
      { day: "чт", cond: "cloudy", temp: 15 },
      { day: "пт", cond: "clear", temp: 18 },
    ],
  },
  {
    id: "sochi",
    name: "сочи",
    temp: 27,
    cond: "clear",
    label: "ясно",
    forecast: [
      { day: "пн", cond: "clear", temp: 27 },
      { day: "вт", cond: "clear", temp: 28 },
      { day: "ср", cond: "cloudy", temp: 26 },
      { day: "чт", cond: "clear", temp: 29 },
      { day: "пт", cond: "clear", temp: 30 },
    ],
  },
];

/** Анимированная инлайн-иконка погоды. uid гарантирует уникальность id градиентов. */
function WeatherIcon({
  cond,
  size = 64,
  uid,
  animate = true,
}: {
  cond: Condition;
  size?: number;
  uid: string;
  animate?: boolean;
}) {
  // фрагменты иконки зависят только от animate — мемоизируем, чтобы не
  // пересоздавать массивы и узлы на каждый рендер виджета
  const sun = useMemo(
    () => (
      <motion.g
        animate={animate ? { rotate: 360 } : undefined}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        style={{ originX: "32px", originY: "32px" }}
      >
        <circle cx="32" cy="32" r="11" fill="#1a1a1a" />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1={32 + Math.cos(a) * 16}
              y1={32 + Math.sin(a) * 16}
              x2={32 + Math.cos(a) * 22}
              y2={32 + Math.sin(a) * 22}
              stroke="#9fff00"
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        })}
      </motion.g>
    ),
    [animate],
  );

  const cloud = useMemo(
    () => (
      <motion.path
        d="M20 40a9 9 0 0 1 1.2-17.9 13 13 0 0 1 24.6 3.3A8 8 0 0 1 44 40Z"
        fill="#1a1a1a"
        animate={animate ? { x: [0, 2, 0] } : undefined}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
    ),
    [animate],
  );

  const drops = useMemo(
    () =>
      [22, 32, 42].map((x, i) => (
        <motion.line
          key={x}
          x1={x}
          y1={44}
          x2={x - 2}
          y2={52}
          stroke="#8e8e8e"
          strokeWidth={2.5}
          strokeLinecap="round"
          animate={animate ? { y: [0, 6], opacity: [0.2, 1, 0.2] } : undefined}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.25,
            ease: "easeIn",
          }}
        />
      )),
    [animate],
  );

  const flakes = useMemo(
    () =>
      [22, 32, 42].map((x, i) => (
        <motion.circle
          key={x}
          cx={x}
          cy={47}
          r={2.2}
          fill="#8e8e8e"
          animate={animate ? { y: [0, 7], opacity: [0.3, 1, 0.3] } : undefined}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: i * 0.3,
            ease: "easeIn",
          }}
        />
      )),
    [animate],
  );

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={CONDITION_LABEL[cond]}
      data-uid={uid}
    >
      {cond === "clear" && sun}
      {cond === "cloudy" && cloud}
      {cond === "rain" && (
        <>
          {cloud}
          {drops}
        </>
      )}
      {cond === "snow" && (
        <>
          {cloud}
          {flakes}
        </>
      )}
    </svg>
  );
}

export default function WeatherWidget() {
  const uid = useId();
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "0px 0px -10% 0px" });
  const [cityId, setCityId] = useState(CITIES[0].id);
  const city = CITIES.find((c) => c.id === cityId) ?? CITIES[0];
  // не крутим иконку вне вьюпорта и при reduce-motion
  const animate = !reduce && inView;

  return (
    <div
      ref={rootRef}
      className="bg-white rounded-xl border border-black/[0.05] shadow-sm p-4 space-y-4"
    >
      <div className="flex gap-1 rounded-full bg-[#1a1a1a]/[0.05] p-0.5 w-fit">
        {CITIES.map((c) => {
          const active = c.id === cityId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCityId(c.id)}
              aria-pressed={active}
              className={`text-[11px] lowercase rounded-full px-3 py-1.5 transition-colors ${
                active
                  ? "bg-[#1a1a1a] text-white"
                  : "text-[#1a1a1a]/55 hover:text-[#1a1a1a]"
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={city.id}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-4"
        >
          <WeatherIcon cond={city.cond} uid={`${uid}-now`} animate={animate} />
          <div>
            <div className="flex items-start">
              <span className="font-display font-medium text-4xl leading-none text-[#1a1a1a] tabular-nums">
                {city.temp}
              </span>
              <span className="font-display text-lg text-[#1a1a1a]/40 mt-0.5">
                °
              </span>
            </div>
            <div className="text-[12px] lowercase text-[#1a1a1a]/55 mt-1">
              {city.label}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-5 gap-1.5 pt-1 border-t border-black/[0.05]">
        {city.forecast.map((d) => (
          <div
            key={`${city.id}-${d.day}`}
            className="flex flex-col items-center gap-1 pt-2"
          >
            <span className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
              {d.day}
            </span>
            <WeatherIcon
              cond={d.cond}
              size={26}
              uid={`${uid}-${d.day}`}
              animate={false}
            />
            <span className="font-display text-[12px] text-[#1a1a1a] tabular-nums">
              {d.temp}°
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
