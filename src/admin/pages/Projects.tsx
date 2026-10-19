import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useProjects } from "../hooks/useProjects";
import { todayISO } from "../lib/dates";
import { PROJECT_STAGES, countByStage, domainOf, dueText, pluralProjects } from "../lib/projects";
import type { Project, ProjectStage } from "../lib/types";
import ProjectRow from "../components/ProjectRow";
import NewProjectModal from "../components/NewProjectModal";
import Spinner from "../components/Spinner";
import { btnPrimary, inputCls } from "../components/controls";

type Filter = ProjectStage | "all" | "closed";

function matches(p: Project, q: string) {
  if (!q) return true;
  const hay = [p.name, p.slug, domainOf(p.source_url), domainOf(p.demo_url), p.contact_name].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q);
}

/** Карточка в колонке доски: без шкалы — этап и так задан колонкой. */
function BoardCard({ project, today }: { project: Project; today: string }) {
  const due = project.next_step_date ? dueText(project.next_step_date, today) : null;
  return (
    <Link
      to={`/admin/projects/${project.id}`}
      className="block rounded-lg border border-zinc-800/80 bg-zinc-900 px-3 py-2.5 transition-colors hover:border-zinc-700"
    >
      <div className="truncate text-sm font-medium text-zinc-100">{project.name}</div>
      <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">{domainOf(project.source_url) ?? project.slug}</div>
      {(project.next_step || due) && (
        <div className="mt-2 border-t border-zinc-800/80 pt-2 text-xs">
          <div className="line-clamp-2 text-zinc-400">{project.next_step || "Шаг не записан"}</div>
          {due && <div className={`mt-1 ${due.overdue ? "text-red-400" : "text-zinc-600"}`}>{due.text}</div>}
        </div>
      )}
    </Link>
  );
}

export default function Projects() {
  const today = todayISO();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { projects, loading, error, add } = useProjects();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const filter = (params.get("stage") as Filter | null) ?? "all";
  const setFilter = (f: Filter) => setParams(f === "all" ? {} : { stage: f }, { replace: true });

  const q = query.trim().toLowerCase();
  const open = useMemo(() => projects.filter((p) => !p.closed && matches(p, q)), [projects, q]);
  const closed = useMemo(() => projects.filter((p) => p.closed && matches(p, q)), [projects, q]);
  const counts = countByStage(projects);
  const list = filter === "closed" ? closed : filter === "all" ? open : open.filter((p) => p.stage === filter);

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "Все", count: projects.filter((p) => !p.closed).length },
    ...PROJECT_STAGES.map((s) => ({ id: s.id as Filter, label: s.label, count: counts[s.id] })),
    { id: "closed", label: "Закрытые", count: projects.filter((p) => p.closed).length },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.015em]">Проекты</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {pluralProjects(projects.filter((p) => !p.closed && p.stage !== "prod").length)} в работе · этапы приходят из плагина webik
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Название или домен"
            aria-label="Поиск проектов"
            className={`${inputCls} sm:w-64`}
          />
          <button type="button" onClick={() => setCreating(true)} className={`${btnPrimary} shrink-0`}>
            + Проект
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">Ошибка загрузки: {error}</p>}

      {loading ? (
        <div className="py-16 text-center"><Spinner /></div>
      ) : (
        <>
          {/* Фильтр по этапам — на мобильном; на десктопе — когда выбран этап или закрытые */}
          <div className={`scroll-x -mx-4 mb-4 overflow-x-auto px-4 ${filter === "all" ? "lg:hidden" : ""}`}>
            <div className="flex w-max gap-1.5">
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFilter(c.id)}
                  aria-pressed={filter === c.id}
                  className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] transition-colors ${
                    filter === c.id ? "bg-zinc-100 text-zinc-950" : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {c.label}
                  <span className={`tabular-nums ${filter === c.id ? "text-zinc-500" : "text-zinc-600"}`}>{c.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`space-y-2 ${filter === "all" ? "lg:hidden" : ""}`}>
            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                {projects.length === 0
                  ? "Проектов пока нет. Запустите /webik:audit — проект появится здесь сам. Или заведите его кнопкой «+ Проект»."
                  : q
                    ? "Ничего не нашлось."
                    : "На этом этапе проектов нет."}
              </p>
            ) : (
              list.map((p) => <ProjectRow key={p.id} project={p} today={today} />)
            )}
          </div>

          {/* Доска: колонка на этап. Только десктоп */}
          {filter === "all" && (
            <>
              <div className="hidden gap-3 lg:grid lg:grid-cols-5">
                {PROJECT_STAGES.map((s, i) => {
                  const col = open.filter((p) => p.stage === s.id);
                  return (
                    <section key={s.id} aria-label={s.label} className="min-w-0">
                      <div className="mb-3">
                        <div className="flex gap-[3px]">
                          {PROJECT_STAGES.map((_, j) => (
                            <span key={j} className={`h-[3px] flex-1 rounded-full ${j < i ? "bg-zinc-600" : j === i ? "bg-brand-green" : "bg-zinc-800"}`} />
                          ))}
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <h2 className="text-sm font-medium text-zinc-200">{s.label}</h2>
                          <span className="text-xs tabular-nums text-zinc-500">{col.length}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {col.map((p) => (
                          <BoardCard key={p.id} project={p} today={today} />
                        ))}
                        {col.length === 0 && <div className="h-16 rounded-lg border border-dashed border-zinc-800/80" />}
                      </div>
                    </section>
                  );
                })}
              </div>
              {closed.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter("closed")}
                  className="mt-8 hidden text-sm text-zinc-500 transition-colors hover:text-zinc-300 lg:inline"
                >
                  Закрытые без выкладки: {closed.length}
                </button>
              )}
            </>
          )}
        </>
      )}

      <NewProjectModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={async (payload) => {
          const res = await add(payload);
          if (res.error || !res.id) return { error: res.error };
          setCreating(false);
          navigate(`/admin/projects/${res.id}`);
          return { error: null };
        }}
      />
    </div>
  );
}
