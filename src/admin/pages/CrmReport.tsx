import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useLeads } from "../hooks/useLeads";
import { funnel, isColdSource, localMonth, lostReasons, stageIndex } from "../lib/crm";
import { formatMoney, todayISO } from "../lib/dates";
import Card from "../components/Card";
import Spinner from "../components/Spinner";

type Cohort = "cold" | "inbound" | "all";
type Period = "all" | "month";

const COHORTS: { id: Cohort; label: string }[] = [
  { id: "cold", label: "Холодные" },
  { id: "inbound", label: "Входящие" },
  { id: "all", label: "Все" },
];

/** Допущения из Воронка.md — рядом с фактом, чтобы видеть расхождение. */
const ASSUMPTIONS: Partial<Record<string, string>> = {
  replied: "5–10%",
  call: "≈40% (с проверкой)",
  proposal: "70%",
  pilot: "30–40%",
};

export default function CrmReport() {
  const { leads, loading, error } = useLeads();
  const [cohort, setCohort] = useState<Cohort>("cold");
  const [period, setPeriod] = useState<Period>("all");

  const cohortLeads = useMemo(
    () =>
      leads.filter((l) =>
        cohort === "all" ? true : cohort === "cold" ? isColdSource(l.source) : !isColdSource(l.source),
      ),
    [leads, cohort],
  );
  const rows = useMemo(() => funnel(cohortLeads), [cohortLeads]);

  const monthPrefix = todayISO().slice(0, 7);
  const reasons = useMemo(
    () =>
      lostReasons(
        period === "all" ? leads : leads.filter((l) => localMonth(l.stage_changed_at) === monthPrefix),
      ),
    [leads, period, monthPrefix],
  );

  // Деньги в работе: сумма сделок на КП и пилоте
  const pipeline = leads
    .filter((l) => stageIndex(l.stage) >= stageIndex("proposal") && stageIndex(l.stage) <= stageIndex("pilot"))
    .reduce((s, l) => s + (l.deal_amount ?? 0), 0);
  const active = leads.filter((l) => l.stage !== "lost").length;
  const maxReached = Math.max(1, ...rows.map((r) => r.reached));

  return (
    <div className="space-y-4">
      <Link to="/admin/archive" className="text-sm text-zinc-400 transition hover:text-zinc-200">
        ← Архив лидов
      </Link>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Отчёт по воронке</h1>

      {error && <p className="text-sm text-red-400">Ошибка загрузки: {error}</p>}

      {loading ? (
        <div className="py-10 text-center"><Spinner /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <div className="text-xs text-zinc-500">Лидов в работе</div>
              <div className="mt-1 font-display text-xl font-semibold">{active}</div>
            </Card>
            <Card>
              <div className="text-xs text-zinc-500">Сумма на КП и пилоте</div>
              <div className="mt-1 font-display text-xl font-semibold">{formatMoney(pipeline)}</div>
            </Card>
          </div>

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold">Конверсии по этапам</h2>
              <div className="flex gap-1.5">
                {COHORTS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCohort(c.id)}
                    className={`rounded-full px-3 py-1 text-xs transition ${
                      cohort === c.id ? "bg-brand-green text-black" : "border border-zinc-700 text-zinc-300 hover:text-zinc-100"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.stage}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-zinc-300">{r.label}</span>
                    <span className="shrink-0 text-zinc-100">
                      {r.reached}
                      {r.fromPrev !== null && <span className="ml-2 text-xs text-zinc-400">{r.fromPrev}%</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full bg-brand-green" style={{ width: `${(r.reached / maxReached) * 100}%` }} />
                  </div>
                  {cohort === "cold" && ASSUMPTIONS[r.stage] && (
                    <div className="mt-0.5 text-[11px] text-zinc-600">в плане: {ASSUMPTIONS[r.stage]}</div>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500">
              Процент — от предыдущего этапа. Лид учитывается на всех этапах, до которых дошёл, даже если
              потом отказался. «Вдогонку» не показывается: ответить могут и на первое письмо.
              {cohort === "cold" && " После 100 отправленных писем замените допущения в Воронка.md фактом."}
            </p>
          </Card>

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold">Причины отказов</h2>
              <div className="flex gap-1.5">
                {(["month", "all"] as Period[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`rounded-full px-3 py-1 text-xs transition ${
                      period === p ? "bg-brand-green text-black" : "border border-zinc-700 text-zinc-300 hover:text-zinc-100"
                    }`}
                  >
                    {p === "month" ? "Этот месяц" : "Всё время"}
                  </button>
                ))}
              </div>
            </div>
            {reasons.signal && (
              <p className="mb-3 rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-300">
                «{reasons.signal.label}» — {reasons.signal.share}% отказов. Больше трети по одной причине — сигнал
                менять упаковку, цену или сегмент, а не скрипт.
              </p>
            )}
            {reasons.total === 0 ? (
              <p className="py-2 text-sm text-zinc-500">Отказов нет.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {reasons.rows.map((r) => (
                  <li key={r.reason ?? "none"} className="flex items-center justify-between gap-2">
                    <span className="text-zinc-300">{r.label}</span>
                    <span className="shrink-0 text-zinc-100">
                      {r.count} <span className="text-xs text-zinc-500">· {r.share}%</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
