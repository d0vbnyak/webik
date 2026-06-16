import { formatMoney } from "../lib/dates";

type StatCardProps = {
  label: string;
  /** Денежное значение (число) — форматируется как рубли. */
  amount?: number;
  /** Либо произвольное значение (если не деньги). */
  value?: string;
  hint?: string;
  /** Цвет значения: tailwind-класс text-*. */
  tone?: string;
};

export default function StatCard({ label, amount, value, hint, tone }: StatCardProps) {
  const display = value ?? (amount !== undefined ? formatMoney(amount) : "—");
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className={`mt-1 font-display text-xl font-semibold tracking-tight ${tone ?? "text-zinc-100"}`}>
        {display}
      </div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}
