import { useId, useState } from "react";
import { motion } from "motion/react";

type Day = { id: string; label: string; busy: string[] };

const TIMES = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

const DAYS: Day[] = [
  { id: "mon", label: "пн 16", busy: ["10:00", "11:00", "14:00"] },
  { id: "tue", label: "вт 17", busy: ["12:00", "16:00"] },
  { id: "wed", label: "ср 18", busy: ["10:00", "13:00", "15:00", "17:00"] },
];

type Picked = { day: string; time: string } | null;

/**
 * Запись на слот: вкладки дней + сетка времени.
 * Эмуляция: «занятые» слоты захардкожены и задизейблены, выбор хранится локально.
 */
export default function SlotBooking() {
  const uid = useId();
  const [dayId, setDayId] = useState(DAYS[0].id);
  const [picked, setPicked] = useState<Picked>(null);

  const day = DAYS.find((d) => d.id === dayId)!;
  const pickedLabel =
    picked && DAYS.find((d) => d.id === picked.day)?.label;

  return (
    <div className="w-full max-w-[460px] mx-auto space-y-3">
      {/* вкладки дней */}
      <div role="tablist" aria-label="выбор дня" className="flex gap-2">
        {DAYS.map((d) => {
          const active = d.id === dayId;
          // подсвечиваем таб дня, в котором лежит выбранный слот
          const hasPick = picked?.day === d.id;
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setDayId(d.id)}
              className={`relative flex-1 rounded-full px-3.5 py-2 text-xs lowercase border transition-colors ${
                active
                  ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                  : "bg-white text-[#1a1a1a]/70 border-black/[0.08] hover:border-black/20"
              }`}
            >
              {d.label}
              {hasPick && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-brand-green border-2 border-white"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* сетка слотов */}
      <div
        role="group"
        aria-label={`свободное время, ${day.label}`}
        className="grid grid-cols-4 gap-2"
      >
        {TIMES.map((t) => {
          const busy = day.busy.includes(t);
          const isPicked = picked?.day === dayId && picked?.time === t;
          return (
            <button
              key={`${uid}-${dayId}-${t}`}
              type="button"
              disabled={busy}
              aria-pressed={isPicked}
              aria-label={`${t}${busy ? ", занято" : ""}`}
              onClick={() =>
                // повторный клик по выбранному слоту — отмена выбора
                setPicked((prev) =>
                  prev?.day === dayId && prev?.time === t
                    ? null
                    : { day: dayId, time: t },
                )
              }
              className={`relative rounded-lg py-2 text-xs tabular-nums border transition-colors ${
                busy
                  ? "bg-[#1a1a1a]/[0.04] text-[#1a1a1a]/25 border-transparent line-through cursor-not-allowed"
                  : isPicked
                    ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                    : "bg-white text-[#1a1a1a]/75 border-black/[0.08] hover:border-black/20"
              }`}
            >
              {t}
              {isPicked && (
                <motion.span
                  layoutId={`${uid}-dot`}
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-brand-green border-2 border-white"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* подтверждение */}
      <div className="min-h-[40px] flex items-center">
        {picked ? (
          <motion.div
            key={`${picked.day}-${picked.time}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 text-sm"
          >
            <span className="grid place-items-center w-5 h-5 rounded-full bg-brand-green text-[#1a1a1a] text-[11px]">
              ✓
            </span>
            <span className="text-[#1a1a1a]">
              вы записаны на{" "}
              <span className="font-display font-medium lowercase">
                {pickedLabel}, {picked.time}
              </span>
            </span>
          </motion.div>
        ) : (
          <span className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
            выберите свободный слот
          </span>
        )}
      </div>
    </div>
  );
}
