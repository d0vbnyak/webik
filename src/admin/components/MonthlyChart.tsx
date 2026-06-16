import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useMonthlyTotals } from "../hooks/useMonthlyTotals";
import { formatMoney } from "../lib/dates";
import Spinner from "./Spinner";

const compact = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${Math.round(v / 1000) / 1000}М`;
  if (abs >= 1000) return `${Math.round(v / 1000)}к`;
  return String(v);
};

export default function MonthlyChart({ year, month }: { year: number; month: number }) {
  const { data, loading, error } = useMonthlyTotals(year, month, 12);

  if (loading) return <div className="py-10 text-center"><Spinner /></div>;
  if (error) return <p className="text-sm text-red-400">Ошибка графика: {error}</p>;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="label" stroke="#71717a" tick={{ fontSize: 12 }} />
        <YAxis stroke="#71717a" tick={{ fontSize: 12 }} tickFormatter={compact} width={44} />
        <Tooltip
          formatter={(value) => formatMoney(Number(value))}
          contentStyle={{
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: 8,
            color: "#fafafa",
          }}
          labelStyle={{ color: "#a1a1aa" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="income" name="Доход" stroke="#9fff00" strokeWidth={2} dot={{ r: 2 }} />
        <Line type="monotone" dataKey="expense" name="Расход" stroke="#f87171" strokeWidth={2} dot={{ r: 2 }} />
        <Line type="monotone" dataKey="profit" name="Прибыль" stroke="#fbbf24" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
