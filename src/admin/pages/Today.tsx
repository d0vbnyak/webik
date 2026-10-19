import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useProjects } from "../hooks/useProjects";
import { useIncomes } from "../hooks/useIncomes";
import { useReceivables } from "../hooks/useReceivables";
import { useSettings } from "../hooks/useSettings";
import { useGoals } from "../hooks/useGoals";
import { db } from "../lib/db";
import { formatMoney, monthLabel, todayISO } from "../lib/dates";
import { remainingToPay } from "../lib/finance";
import {
  PROJECT_STAGES,
  countByStage,
  daysSince,
  domainOf,
  isActive,
  projectsDue,
  waitingOnClient,
} from "../lib/projects";
import { pluralDeals } from "../lib/crm";
import type { Lead } from "../lib/types";
import ProjectRow from "../components/ProjectRow";
import NewProjectModal, { type ProjectDraft } from "../components/NewProjectModal";
import Spinner from "../components/Spinner";
import { IconArrow, IconExternal } from "../components/icons";

const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">{children}</h2>
      {aside}
    </div>
  );
}

/** Заявка с сайта или из чата: ждёт решения — в проект или в архив. */
function InboxRow({ lead, onProject, onArchive, busy }: { lead: Lead; onProject: () => void; onArchive: () => void; busy: boolean }) {
  const contact = [lead.contact_name, lead.phone, lead.email, lead.telegram_username && `@${lead.telegram_username}`]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="rounded-xl border border-amber-400/25 bg-zinc-900 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <Link to={`/admin/archive/${lead.id}`} className="truncate text-[15px] font-medium text-zinc-100 hover:underline">
          {lead.company}
        </Link>
        <span className="shrink-0 text-xs text-amber-400">{lead.source ?? "Заявка"}</span>
      </div>
      {contact && <div className="mt-0.5 truncate text-xs text-zinc-500">{contact}</div>}
      {lead.business && <p className="mt-2 line-clamp-2 text-[13px] text-zinc-300">{lead.business}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onProject}
          disabled={busy}
          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[13px] font-medium text-zinc-950 transition active:scale-[0.97] disabled:opacity-60"
        >
          В проект
        </button>
        <button
          type="button"
          onClick={onArchive}
          disabled={busy}
          className="rounded-lg px-3 py-1.5 text-[13px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-60"
        >
          В архив
        </button>
      </div>
    </div>
  );
}

/** Новые заявки с сайта и из чата: неразобранные лиды. Архив не грузим. */
function useInbox() {
  const [inbox, setInbox] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error: selErr } = await db.from("leads").select("*").eq("archived", false).order("created_at");
    if (selErr) return setError(selErr.message);
    setError(null);
    setInbox((data ?? []) as Lead[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { inbox, error, reload: load };
}

export default function Today() {
  const today = todayISO();
  const navigate = useNavigate();
  const [y, m, d] = today.split("-").map(Number);
  const dateLine = `${WEEKDAYS[new Date(y, m - 1, d).getDay()]}, ${d} ${MONTHS[m - 1]}`;

  const { projects, loading, error, add } = useProjects();
  const inboxHook = useInbox();
  const incomesHook = useIncomes(y, m);
  const receivables = useReceivables();
  const { settings } = useSettings();
  const { getGoal } = useGoals();

  const [draft, setDraft] = useState<{ lead: Lead; data: ProjectDraft } | null>(null);
  const [busyLead, setBusyLead] = useState<string | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);

  const due = projectsDue(projects, today);
  const overdue = due.filter((p) => (p.next_step_date ?? "") < today).length;
  const inbox = inboxHook.inbox;
  const waiting = waitingOnClient(projects);
  const counts = countByStage(projects.filter(isActive));
  const activeCount = projects.filter(isActive).length;
  const focal = due.length + inbox.length;

  const received = incomesHook.incomes.reduce((s, i) => s + i.paid_amount, 0);
  const owed = receivables.items.reduce((s, i) => s + remainingToPay(i), 0);
  const goal = getGoal(y, m)?.target_amount ?? settings?.default_monthly_goal ?? 0;
  const pct = goal > 0 ? Math.min(100, Math.round((received / goal) * 100)) : 0;

  async function archiveLead(lead: Lead) {
    setBusyLead(lead.id);
    setInboxError(null);
    const { error: updErr } = await db.from("leads").update({ archived: true }).eq("id", lead.id);
    setBusyLead(null);
    if (updErr) return setInboxError(updErr.message);
    void inboxHook.reload();
  }

  function startProject(lead: Lead) {
    setDraft({
      lead,
      data: {
        name: lead.company.replace(/\s+—\s+заявка с сайта$/i, ""),
        source_url: lead.website ?? "",
        contact_name: lead.contact_name,
        phone: lead.phone,
        email: lead.email,
        telegram_username: lead.telegram_username,
        note: lead.business,
      },
    });
  }

  if (loading) return <div className="py-16 text-center"><Spinner /></div>;

  return (
    <div>
      <header className="mb-8">
        <p className="text-sm text-zinc-500 first-letter:uppercase">{dateLine}</p>
        <h1 className="mt-1 font-display text-[44px] font-semibold leading-none tracking-[-0.02em] text-zinc-100">
          {focal === 0 ? "Всё чисто" : pluralDeals(focal)}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {focal === 0
            ? "Сроков на сегодня нет и новых заявок тоже."
            : [
                overdue ? <span key="o" className="text-red-400">просрочено: {overdue}</span> : null,
                inbox.length ? <span key="i" className="text-amber-400">новых заявок: {inbox.length}</span> : null,
                due.length - overdue > 0 ? <span key="t">на сегодня: {due.length - overdue}</span> : null,
              ]
                .filter(Boolean)
                .flatMap((el, i) => (i ? [<span key={`s${i}`} className="text-zinc-600"> · </span>, el] : [el]))}
        </p>
      </header>

      {error && <p className="mb-4 text-sm text-red-400">Проекты не загрузились: {error}</p>}
      {inboxHook.error && <p className="mb-4 text-sm text-red-400">Заявки не загрузились: {inboxHook.error}</p>}
      {inboxError && inbox.length === 0 && <p className="mb-4 text-sm text-red-400">{inboxError}</p>}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <div className="space-y-10">
          {inbox.length > 0 && (
            <section>
              <SectionTitle>Новые заявки</SectionTitle>
              {inboxError && <p className="mb-2 text-sm text-red-400">{inboxError}</p>}
              <div className="space-y-2">
                {inbox.map((l) => (
                  <InboxRow
                    key={l.id}
                    lead={l}
                    busy={busyLead === l.id}
                    onProject={() => startProject(l)}
                    onArchive={() => void archiveLead(l)}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionTitle
              aside={
                <Link to="/admin/projects" className="text-xs text-zinc-500 transition-colors hover:text-zinc-300">
                  Все проекты
                </Link>
              }
            >
              Дела по проектам
            </SectionTitle>
            {due.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                {projects.length === 0
                  ? "Проектов пока нет. Они появятся сами, когда плагин webik пройдёт аудит, — или заведите проект вручную в разделе «Проекты»."
                  : "На сегодня шагов нет. Ближайшие — в разделе «Проекты»."}
              </div>
            ) : (
              <div className="space-y-2">
                {due.map((p) => (
                  <ProjectRow key={p.id} project={p} today={today} />
                ))}
              </div>
            )}
          </section>

          {waiting.length > 0 && (
            <section>
              <SectionTitle>Демо у клиента</SectionTitle>
              <ul className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800/80">
                {waiting.map((p) => {
                  const days = daysSince(p.stage_changed_at, today);
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <Link to={`/admin/projects/${p.id}`} className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-zinc-100">{p.name}</div>
                        <div className="truncate font-mono text-xs text-zinc-500">{domainOf(p.demo_url) ?? p.slug}</div>
                      </Link>
                      <span className={`shrink-0 text-xs tabular-nums ${days >= 7 ? "text-amber-400" : "text-zinc-500"}`}>
                        {days === 0 ? "с сегодня" : `${days} дн.`}
                      </span>
                      {p.demo_url && /^https?:\/\//i.test(p.demo_url) && (
                        <a
                          href={p.demo_url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Открыть демо ${p.name}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                        >
                          <IconExternal />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-10">
          <section>
            <SectionTitle>В работе · {activeCount}</SectionTitle>
            <ul className="space-y-2">
              {PROJECT_STAGES.filter((s) => s.id !== "prod").map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/admin/projects?stage=${s.id}`}
                    className="flex items-center gap-3 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
                  >
                    <span className="w-16 shrink-0">{s.label}</span>
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-900">
                      <span
                        className="block h-full rounded-full bg-zinc-500"
                        style={{ width: activeCount ? `${(counts[s.id] / activeCount) * 100}%` : 0 }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-right tabular-nums text-zinc-200">{counts[s.id]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <SectionTitle
              aside={
                <Link to="/admin/money" className="inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300">
                  Деньги <IconArrow />
                </Link>
              }
            >
              {monthLabel(y, m)}
            </SectionTitle>
            <div className="font-display text-2xl font-semibold tracking-tight text-zinc-100">{formatMoney(received)}</div>
            <div className="mt-0.5 text-xs text-zinc-500">
              получено{goal > 0 ? ` · ${pct}% от цели ${formatMoney(goal)}` : ""}
            </div>
            {goal > 0 && (
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-900">
                <div className="h-full rounded-full bg-brand-green" style={{ width: `${pct}%` }} />
              </div>
            )}
            {owed > 0 && (
              <div className="mt-4 flex items-baseline justify-between text-sm">
                <span className="text-zinc-400">Ждём оплату</span>
                <span className="tabular-nums text-amber-400">{formatMoney(owed)}</span>
              </div>
            )}
          </section>
        </aside>
      </div>

      <NewProjectModal
        open={!!draft}
        draft={draft?.data}
        onClose={() => setDraft(null)}
        onCreate={async (payload) => {
          const res = await add(payload);
          if (res.error || !res.id) return { error: res.error };
          // Заявка разобрана — уходит в архив, проект открывается
          const { error: archErr } = await db.from("leads").update({ archived: true }).eq("id", draft!.lead.id);
          setDraft(null);
          // Ошибку показываем здесь же: после перехода её бы никто не увидел
          if (archErr) {
            setInboxError(`Проект создан, но заявка осталась во входящих: ${archErr.message}. Уберите её кнопкой «В архив».`);
            return { error: null };
          }
          navigate(`/admin/projects/${res.id}`);
          return { error: null };
        }}
      />
    </div>
  );
}
