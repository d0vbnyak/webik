import { useEffect, useState } from "react";
import { useSettings } from "../hooks/useSettings";
import { useCategories } from "../hooks/useCategories";
import { useGoals } from "../hooks/useGoals";
import { usePeriod } from "../context/PeriodContext";
import type { CategoryType } from "../lib/types";
import { formatMoney, monthLabel } from "../lib/dates";
import Card from "../components/Card";
import PluginTokenCard from "../components/PluginTokenCard";
import MoneyInput from "../components/MoneyInput";
import Spinner from "../components/Spinner";
import { inputCls, labelCls, btnPrimary, btnGhost } from "../components/controls";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function CategoryEditor({ type, title }: { type: CategoryType; title: string }) {
  const { byType, addCategory, removeCategory } = useCategories();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const list = byType(type);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    await addCategory(type, name);
    setBusy(false);
    setName("");
  }

  return (
    <div>
      <div className="mb-2 text-sm text-zinc-300">{title}</div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {list.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200"
          >
            {c.name}
            <button
              type="button"
              onClick={() => void removeCategory(c.id)}
              aria-label={`Удалить ${c.name}`}
              className="text-zinc-500 transition hover:text-red-400"
            >
              ✕
            </button>
          </span>
        ))}
        {list.length === 0 && <span className="text-xs text-zinc-600">нет категорий</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Новая категория"
          className={inputCls}
        />
        <button type="button" onClick={() => void add()} disabled={busy} className={btnGhost}>
          Добавить
        </button>
      </div>
    </div>
  );
}

/** Число из поля ввода: запятая как разделитель. null — пусто, мусор или минус. */
function num(input: string): number | null {
  const n = parseFloat(input.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function Settings() {
  const { settings, loading, error, update } = useSettings();
  const { getGoal, setGoal } = useGoals();
  const period = usePeriod();

  // Локальные значения настроек
  const [taxRate, setTaxRate] = useState("6");
  const [taxReducedRate, setTaxReducedRate] = useState("4");
  const [taxDeduction, setTaxDeduction] = useState(0);
  const [defaultGoal, setDefaultGoal] = useState(0);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (settings) {
      setTaxRate(String(settings.tax_rate));
      setTaxReducedRate(String(settings.tax_reduced_rate));
      setTaxDeduction(settings.tax_deduction_start);
      setDefaultGoal(settings.default_monthly_goal ?? 0);
    }
  }, [settings]);

  async function saveSettings() {
    const rate = num(taxRate);
    const reduced = num(taxReducedRate);
    // Молча привести ставку к нулю нельзя: обнулится весь расчёт налога.
    const problem =
      rate === null
        ? "Полная ставка: укажите число не меньше нуля"
        : reduced === null
          ? "Ставка с вычетом: укажите число не меньше нуля"
          : reduced > rate
            ? "Ставка с вычетом не может быть выше полной"
            : null;
    if (problem) {
      setSaveFailed(true);
      setSavedNote(problem);
      setTimeout(() => setSavedNote(null), 4000);
      return;
    }
    const res = await update({
      tax_rate: rate as number,
      tax_reduced_rate: reduced as number,
      tax_deduction_start: taxDeduction > 0 ? taxDeduction : 0,
      default_monthly_goal: defaultGoal > 0 ? defaultGoal : null,
    });
    setSaveFailed(Boolean(res.error));
    setSavedNote(res.error ? `Ошибка: ${res.error}` : "Сохранено");
    setTimeout(() => setSavedNote(null), 2500);
  }

  // Цель на конкретный месяц
  const [goalYear, setGoalYear] = useState(period.year);
  const [goalMonth, setGoalMonth] = useState(period.month);
  const [goalAmount, setGoalAmount] = useState(0);
  const [goalNote, setGoalNote] = useState<string | null>(null);

  useEffect(() => {
    const g = getGoal(goalYear, goalMonth);
    setGoalAmount(g?.target_amount ?? 0);
  }, [goalYear, goalMonth, getGoal]);

  async function saveGoal() {
    if (goalAmount <= 0) {
      setGoalNote("Укажите сумму цели");
      return;
    }
    const res = await setGoal(goalYear, goalMonth, goalAmount);
    setGoalNote(res.error ? `Ошибка: ${res.error}` : `Цель на ${monthLabel(goalYear, goalMonth)} сохранена`);
    setTimeout(() => setGoalNote(null), 2500);
  }

  const years: number[] = [];
  for (let y = period.year + 1; y >= period.year - 6; y--) years.push(y);

  if (loading) return <div className="py-10 text-center"><Spinner /></div>;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Настройки</h1>
      {error && <p className="text-sm text-red-400">Ошибка загрузки: {error}</p>}

      {/* Налог и цель по умолчанию */}
      <Card>
        <h2 className="mb-3 font-display text-base font-semibold">Налог и цель по умолчанию</h2>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Полная ставка налога, %</label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className={`${inputCls} mt-1`}
            />
            <p className="mt-1 text-xs text-zinc-500">
              НПД: 6% с дохода от юрлиц и ИП, 4% — от физлиц.
            </p>
          </div>
          <div>
            <label className={labelCls}>Ставка с вычетом, %</label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={taxReducedRate}
              onChange={(e) => setTaxReducedRate(e.target.value)}
              className={`${inputCls} mt-1`}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Пока не израсходован вычет: 4% вместо 6% (юрлица) или 3% вместо 4% (физлица).
            </p>
          </div>
          <div>
            <label className={labelCls}>Вычет на старте учёта, ₽</label>
            <div className="mt-1">
              <MoneyInput value={taxDeduction} onChange={setTaxDeduction} placeholder="10 000" />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Вычет даётся один раз на всё время работы, а не каждый год. Здесь — сколько
              его оставалось <b>до самого раннего дохода</b>, заведённого в админку: дальше
              он списывается сам, по разнице между ставками. Текущий остаток показан на
              дашборде, переписывать его сюда не нужно. Сверить — в «Мой налог».
              0 — считать по полной ставке.
            </p>
          </div>
          <div>
            <label className={labelCls}>Цель по доходу на месяц по умолчанию, ₽</label>
            <div className="mt-1">
              <MoneyInput value={defaultGoal} onChange={setDefaultGoal} placeholder="0 — не задана" />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Используется, если на конкретный месяц цель не задана.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void saveSettings()} className={btnPrimary}>
              Сохранить
            </button>
            {savedNote && (
              <span className={`text-sm ${saveFailed ? "text-red-400" : "text-zinc-400"}`}>{savedNote}</span>
            )}
          </div>
        </div>
      </Card>

      {/* Цель на конкретный месяц */}
      <Card>
        <h2 className="mb-3 font-display text-base font-semibold">Цель на конкретный месяц</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelCls}>Месяц</label>
            <select
              value={goalMonth}
              onChange={(e) => setGoalMonth(Number(e.target.value))}
              className={`${inputCls} mt-1`}
            >
              {MONTHS.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Год</label>
            <select
              value={goalYear}
              onChange={(e) => setGoalYear(Number(e.target.value))}
              className={`${inputCls} mt-1`}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px] flex-1">
            <label className={labelCls}>Цель, ₽</label>
            <div className="mt-1">
              <MoneyInput value={goalAmount} onChange={setGoalAmount} />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={() => void saveGoal()} className={btnPrimary}>
            Сохранить цель
          </button>
          {goalNote && <span className="text-sm text-zinc-400">{goalNote}</span>}
        </div>
        {goalAmount > 0 && (
          <p className="mt-2 text-xs text-zinc-500">
            Текущая цель на {monthLabel(goalYear, goalMonth)}: {formatMoney(goalAmount)}
          </p>
        )}
      </Card>

      <PluginTokenCard />

      {/* Категории */}
      <Card>
        <h2 className="mb-3 font-display text-base font-semibold">Категории</h2>
        <div className="space-y-4">
          <CategoryEditor type="income" title="Доходы" />
          <CategoryEditor type="expense" title="Расходы" />
        </div>
      </Card>
    </div>
  );
}
