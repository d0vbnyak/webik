import { usePeriod } from "../context/PeriodContext";
import { monthLabel, todayISO } from "../lib/dates";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export default function MonthSwitcher() {
  const { year, month, setPeriod, prevMonth, nextMonth } = usePeriod();
  const currentYear = Number(todayISO().slice(0, 4));
  const years: number[] = [];
  for (let y = currentYear + 1; y >= currentYear - 6; y--) years.push(y);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={prevMonth}
        aria-label="Предыдущий месяц"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:text-brand-green"
      >
        ‹
      </button>

      <div className="hidden min-w-[150px] text-center font-display text-base font-medium text-zinc-100 sm:block">
        {monthLabel(year, month)}
      </div>

      {/* Прямой выбор месяца/года — на мобильном это основной способ */}
      <div className="flex items-center gap-1">
        <select
          value={month}
          onChange={(e) => setPeriod(year, Number(e.target.value))}
          aria-label="Месяц"
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-brand-green"
        >
          {MONTHS.map((name, i) => (
            <option key={i} value={i + 1}>{name}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setPeriod(Number(e.target.value), month)}
          aria-label="Год"
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-brand-green"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={nextMonth}
        aria-label="Следующий месяц"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:text-brand-green"
      >
        ›
      </button>
    </div>
  );
}
