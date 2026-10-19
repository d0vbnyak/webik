import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useCandidates } from "../hooks/useCandidates";
import { useProjects } from "../hooks/useProjects";
import { CANDIDATE_STATUSES, candidateStatusLabel, parseCandidatesJson, problemList, sortCandidates, type ParsedImport } from "../lib/candidates";
import { todayISO, formatDate } from "../lib/dates";
import type { Candidate, CandidateStatus } from "../lib/types";
import NewProjectModal, { type ProjectDraft } from "../components/NewProjectModal";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import { IconExternal } from "../components/icons";
import { btnGhost, btnPrimary, inputCls } from "../components/controls";

type Filter = CandidateStatus | "all";

const action = "rounded-lg px-3 py-1.5 text-[13px] transition-colors disabled:opacity-60";
const actionMain = `${action} bg-zinc-100 font-medium text-zinc-950 active:scale-[0.97]`;
const actionQuiet = `${action} text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200`;

function CandidateRow({
  c,
  busy,
  onStatus,
  onProject,
}: {
  c: Candidate;
  busy: boolean;
  onStatus: (s: CandidateStatus) => void;
  onProject: () => void;
}) {
  const problems = problemList(c.problems);
  const safeUrl = /^https?:\/\//i.test(c.site_url) ? c.site_url : null;
  const muted = c.status === "declined";
  return (
    <li className={`min-w-0 rounded-xl border border-zinc-800/80 bg-zinc-900 px-4 py-3 ${muted ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[15px] font-medium text-zinc-100">{c.name}</span>
        <span className={`shrink-0 text-xs ${c.status === "new" ? "text-amber-400" : "text-zinc-500"}`}>
          {c.status === "contacted" && c.contacted_at ? `написали ${formatDate(c.contacted_at)}` : candidateStatusLabel(c.status)}
        </span>
      </div>
      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-zinc-500">
        {safeUrl ? (
          <a href={safeUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 font-mono text-zinc-400 hover:text-brand-green">
            <span className="truncate">{c.domain}</span>
            <IconExternal />
          </a>
        ) : (
          <span className="font-mono">{c.domain}</span>
        )}
        {[c.city, c.niche].filter(Boolean).map((t) => (
          <span key={t}>· {t}</span>
        ))}
      </div>
      {problems.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {problems.map((p) => (
            <li key={p} className="rounded-md bg-zinc-800/70 px-2 py-0.5 text-xs text-zinc-300">
              {p}
            </li>
          ))}
        </ul>
      )}
      {(c.phone || c.email) && (
        <div className="mt-2.5 flex flex-wrap gap-x-4 text-[13px]">
          {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="text-zinc-300 hover:text-zinc-100">{c.phone}</a>}
          {c.email && <a href={`mailto:${c.email}`} className="text-zinc-300 hover:text-zinc-100">{c.email}</a>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {c.status === "converted" ? (
          c.project_id && <Link to={`/admin/projects/${c.project_id}`} className={actionQuiet}>Открыть проект</Link>
        ) : (
          <>
            {c.status === "new" && (
              <button type="button" disabled={busy} onClick={() => onStatus("contacted")} className={actionMain}>
                Написал
              </button>
            )}
            {c.status !== "declined" && (
              <button type="button" disabled={busy} onClick={onProject} className={c.status === "new" ? actionQuiet : actionMain}>
                В проект
              </button>
            )}
            {c.status === "declined" || c.status === "contacted" ? (
              <button type="button" disabled={busy} onClick={() => onStatus("new")} className={actionQuiet}>
                Вернуть
              </button>
            ) : null}
            {c.status !== "declined" && (
              <button type="button" disabled={busy} onClick={() => onStatus("declined")} className={actionQuiet}>
                Отказ
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

export default function Candidates() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { candidates, loading, error, update, importMany } = useCandidates();
  const { add: addProject } = useProjects();

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ c: Candidate; data: ProjectDraft } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const raw = params.get("status");
  const filter: Filter = CANDIDATE_STATUSES.some((s) => s.id === raw) ? (raw as Filter) : raw === "all" ? "all" : "new";
  const setFilter = (f: Filter) => setParams(f === "new" ? {} : { status: f }, { replace: true });

  const counts = useMemo(() => {
    const m = new Map<CandidateStatus, number>();
    for (const c of candidates) m.set(c.status, (m.get(c.status) ?? 0) + 1);
    return m;
  }, [candidates]);
  const list = sortCandidates(filter === "all" ? candidates : candidates.filter((c) => c.status === filter));

  async function setStatus(c: Candidate, status: CandidateStatus) {
    setBusy(c.id);
    setActionError(null);
    const res = await update(c.id, {
      status,
      contacted_at: status === "contacted" ? todayISO() : status === "new" ? null : c.contacted_at,
    });
    setBusy(null);
    if (res.error) setActionError(res.error);
  }

  function readFile(file: File | undefined) {
    if (!file) return;
    file.text().then((t) => {
      setImportText(t);
      setParsed(parseCandidatesJson(t));
    });
  }

  async function runImport() {
    if (!parsed || parsed.items.length === 0) return;
    setImporting(true);
    const res = await importMany(parsed.items);
    setImporting(false);
    if (res.error) return setImportResult(`Ошибка: ${res.error}`);
    setImportOpen(false);
    setImportText("");
    setParsed(null);
    setImportResult(
      `Добавлено: ${res.added}.` + (res.skipped.length ? ` Уже были: ${res.skipped.length} (${res.skipped.slice(0, 5).join(", ")}${res.skipped.length > 5 ? "…" : ""}).` : ""),
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.015em]">Кандидаты</h1>
          <p className="mt-1 text-sm text-zinc-500">Действующие фирмы со старыми сайтами — кому предложить редизайн</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setImportOpen(true);
            setImportResult(null);
          }}
          className={btnGhost}
        >
          Импорт
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">Ошибка загрузки: {error}</p>}
      {actionError && <p className="mb-4 text-sm text-red-400">{actionError}</p>}
      {importResult && <p className="mb-4 text-sm text-zinc-300">{importResult}</p>}

      {loading ? (
        <div className="py-16 text-center"><Spinner /></div>
      ) : (
        <>
          <div className="scroll-x -mx-4 mb-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            <div className="flex w-max gap-1.5">
              {[...CANDIDATE_STATUSES.map((s) => ({ id: s.id as Filter, label: s.label, count: counts.get(s.id) ?? 0 })), { id: "all" as Filter, label: "Все", count: candidates.length }].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilter(chip.id)}
                  aria-pressed={filter === chip.id}
                  className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] transition-colors ${
                    filter === chip.id ? "bg-zinc-100 text-zinc-950" : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {chip.label}
                  <span className={`tabular-nums ${filter === chip.id ? "text-zinc-500" : "text-zinc-600"}`}>{chip.count}</span>
                </button>
              ))}
            </div>
          </div>

          {list.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
              {candidates.length === 0
                ? "Кандидатов пока нет. Загрузите файл с отобранными сайтами кнопкой «Импорт»."
                : "В этом статусе никого нет."}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {list.map((c) => (
                <CandidateRow
                  key={c.id}
                  c={c}
                  busy={busy === c.id}
                  onStatus={(s) => void setStatus(c, s)}
                  onProject={() =>
                    setDraft({
                      c,
                      data: {
                        name: c.name,
                        source_url: c.site_url,
                        phone: c.phone,
                        email: c.email,
                        note: problemList(c.problems).length ? `Что не так со старым сайтом:\n${problemList(c.problems).map((p) => `— ${p}`).join("\n")}` : null,
                      },
                    })
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Импорт кандидатов">
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
            JSON-массив: <span className="font-mono text-xs">name, site_url, city, niche, phone, email, problems[], score</span>. Домены, которые уже есть, пропускаются.
          </p>
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => readFile(e.target.files?.[0])}
            className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200"
          />
          <textarea
            rows={5}
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setParsed(e.target.value.trim() ? parseCandidatesJson(e.target.value) : null);
            }}
            placeholder="или вставьте содержимое файла"
            aria-label="Содержимое файла импорта"
            className={`${inputCls} font-mono text-xs`}
          />
          {parsed && (
            <div className="text-sm">
              <p className="text-zinc-300">Готово к загрузке: {parsed.items.length}</p>
              {parsed.errors.length > 0 && (
                <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-red-400">
                  {parsed.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setImportOpen(false)} className={btnGhost}>Отмена</button>
            <button type="button" disabled={importing || !parsed?.items.length} onClick={() => void runImport()} className={btnPrimary}>
              {importing ? "Загружаю…" : `Добавить${parsed?.items.length ? ` ${parsed.items.length}` : ""}`}
            </button>
          </div>
        </div>
      </Modal>

      <NewProjectModal
        open={!!draft}
        draft={draft?.data}
        onClose={() => setDraft(null)}
        onCreate={async (payload) => {
          const res = await addProject(payload);
          if (res.error || !res.id) return { error: res.error };
          const link = await update(draft!.c.id, { status: "converted", project_id: res.id });
          setDraft(null);
          // Проект создан; если кандидат не обновился — говорим здесь, а не после перехода
          if (link.error) {
            setActionError(`Проект создан, но кандидат не отмечен: ${link.error}`);
            return { error: null };
          }
          navigate(`/admin/projects/${res.id}`);
          return { error: null };
        }}
      />
    </div>
  );
}
