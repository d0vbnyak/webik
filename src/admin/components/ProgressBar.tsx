import { formatMoney } from "../lib/dates";

type ProgressBarProps = {
  /** Достигнуто (например, полученный доход). */
  value: number;
  /** Цель. Если 0/не задана — показываем подсказку вместо полосы. */
  target: number;
};

export default function ProgressBar({ value, target }: ProgressBarProps) {
  if (!target || target <= 0) {
    return (
      <p className="text-sm text-zinc-500">
        Цель на месяц не задана. Задайте её в «Настройках».
      </p>
    );
  }
  const pct = Math.min(100, Math.round((value / target) * 100));
  const remaining = Math.max(0, target - value);
  const reached = remaining === 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-zinc-300">
          {formatMoney(value)} <span className="text-zinc-500">из {formatMoney(target)}</span>
        </span>
        <span className={reached ? "text-brand-green" : "text-zinc-400"}>{pct}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-brand-green transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-zinc-500">
        {reached ? "Цель достигнута 🎉" : `Осталось ${formatMoney(remaining)}`}
      </div>
    </div>
  );
}
