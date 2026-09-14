import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useLeads } from "../hooks/useLeads";
import { ALL_STAGES, SOURCES, VARIANTS, defaultNextStep, dueToday, isColdSource, stageLabel } from "../lib/crm";
import { parseTable, rowsToLeads, scheduleFirstEmails, type ImportedLead } from "../lib/leadImport";
import { formatDate, todayISO } from "../lib/dates";
import { daysUntil } from "../lib/recurring";
import type { Lead, LeadStage } from "../lib/types";
import Card from "../components/Card";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import StageChip from "../components/StageChip";
import { inputCls, labelCls, btnPrimary, btnGhost } from "../components/controls";

type Filter = "active" | "all" | LeadStage;

type FormState = {
  company: string;
  city: string;
  website: string;
  email: string;
  phone: string;
  contact_name: string;
  source: string;
  priority: string;
  variant: string;
};

const emptyForm: FormState = {
  company: "",
  city: "",
  website: "",
  email: "",
  phone: "",
  contact_name: "",
  source: SOURCES[0],
  priority: "",
  variant: "",
};

/** «сегодня», «просрочено на 3 дн.» или дата. */
function dueLabel(date: string, today: string): { text: string; overdue: boolean } {
  const left = daysUntil(date, today);
  if (left < 0) return { text: `просрочено ${-left} дн.`, overdue: true };
  if (left === 0) return { text: "сегодня", overdue: false };
  return { text: formatDate(date), overdue: false };
}

export default function Crm() {
  const today = todayISO();
  const navigate = useNavigate();
  const { leads, loading, error, add, importMany } = useLeads();

  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<{ items: ImportedLead[]; errors: string[] } | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const todayList = useMemo(() => dueToday(leads, today), [leads, today]);

  const counts = useMemo(() => {
    const m = new Map<LeadStage, number>();
    for (const l of leads) m.set(l.stage, (m.get(l.stage) ?? 0) + 1);
    return m;
  }, [leads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter === "active" && l.stage === "lost") return false;
      if (filter !== "active" && filter !== "all" && l.stage !== filter) return false;
      if (!q) return true;
      return [l.company, l.city, l.website, l.contact_name].some((v) => v?.toLowerCase().includes(q));
    });
  }, [leads, filter, query]);

  function openNew() {
    setForm(emptyForm);
    setFormError(null);
    setOpen(true);
  }

  async function save() {
    if (!form.company.trim()) return setFormError("Введите название компании");
    // Входящие (сайт, бот, рекомендация) начинают сразу с «Ответили» — см. Воронка.md
    const stage: LeadStage = isColdSource(form.source) ? "new" : "replied";
    const next = defaultNextStep(stage, today);
    setSaving(true);
    const res = await add({
      company: form.company.trim(),
      inn: null,
      city: form.city.trim() || null,
      website: form.website.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      contact_name: form.contact_name.trim() || null,
      telegram_username: null,
      other_channels: null,
      business: null,
      hook: null,
      variant: form.variant || null,
      first_line: null,
      priority: form.priority ? Number(form.priority) : null,
      source: form.source,
      stage,
      reached_stage: stage,
      lost_reason: null,
      next_step: next.text,
      next_step_date: next.date,
      deal_amount: null,
      client_id: null,
    });
    setSaving(false);
    if (res.error) return setFormError(res.error);
    setOpen(false);
    if (res.id) navigate(`/admin/crm/${res.id}`);
  }

  function openImport() {
    setImportText("");
    setPreview(null);
    setImportResult(null);
    setImportOpen(true);
  }

  function parseImport() {
    setImportResult(null);
    const parsed = rowsToLeads(parseTable(importText), today);
    scheduleFirstEmails(parsed.items, today);
    setPreview(parsed);
  }

  async function runImport() {
    if (!preview || preview.items.length === 0) return;
    setImporting(true);
    const res = await importMany(preview.items);
    setImporting(false);
    if (res.error && res.added === 0) return setImportResult(`Ошибка: ${res.error}`);
    setPreview(null);
    setImportText("");
    setImportResult(
      `Добавлено: ${res.added}. Уже были в базе: ${res.skipped}.` + (res.error ? ` ${res.error}` : ""),
    );
  }

  const set = (k: keyof FormState) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "active", label: "В работе", count: leads.length - (counts.get("lost") ?? 0) },
    ...ALL_STAGES.filter((s) => counts.get(s)).map((s) => ({ id: s as Filter, label: stageLabel(s), count: counts.get(s) ?? 0 })),
    { id: "all", label: "Все", count: leads.length },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Воронка</h1>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/crm/report" className={btnGhost}>
            Отчёт
          </Link>
          <button type="button" onClick={openImport} className={btnGhost}>
            Импорт
          </button>
          <button type="button" onClick={openNew} className={btnPrimary}>
            + Лид
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">Ошибка загрузки: {error}</p>}

      {loading ? (
        <div className="py-10 text-center"><Spinner /></div>
      ) : (
        <div className="space-y-5">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Сегодня</h2>
              <span className="text-xs text-zinc-400">{todayList.length} дел</span>
            </div>
            {todayList.length === 0 ? (
              <p className="py-2 text-sm text-zinc-500">
                {leads.length === 0 ? "Лидов пока нет — добавьте или импортируйте из таблицы." : "На сегодня всё сделано."}
              </p>
            ) : (
              <ul className="space-y-2">
                {todayList.map((l) => {
                  const due = dueLabel(l.next_step_date!, today);
                  return (
                    <li key={l.id}>
                      <Link
                        to={`/admin/crm/${l.id}`}
                        className={`block rounded-lg border px-3 py-2 transition hover:border-zinc-600 ${
                          due.overdue ? "border-red-900/60 bg-red-950/20" : "border-zinc-800 bg-zinc-950/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-zinc-100">{l.company}</span>
                          <StageChip stage={l.stage} />
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-zinc-400">{l.next_step || "Следующий шаг не задан"}</span>
                          <span className={`shrink-0 ${due.overdue ? "text-red-400" : "text-zinc-500"}`}>{due.text}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск: компания, город, сайт"
              className={`${inputCls} mb-3`}
            />
            <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFilter(c.id)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs transition ${
                    filter === c.id ? "bg-brand-green text-black" : "border border-zinc-700 text-zinc-300 hover:text-zinc-100"
                  }`}
                >
                  {c.label} · {c.count}
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">Ничего не найдено.</p>
            ) : (
              <ul className="space-y-2">
                {visible.map((l) => (
                  <LeadRow key={l.id} lead={l} today={today} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Новый лид">
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Компания</label>
            <input type="text" value={form.company} onChange={set("company")} className={`${inputCls} mt-1`} placeholder="Обязательно" />
          </div>
          <div>
            <label className={labelCls}>Откуда</label>
            <select value={form.source} onChange={set("source")} className={`${inputCls} mt-1`}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              {isColdSource(form.source)
                ? "Холодный лид — начнёт с «Не писал»."
                : "Входящее обращение — сразу на «Ответили», ответить сегодня."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Город</label>
              <input type="text" value={form.city} onChange={set("city")} className={`${inputCls} mt-1`} />
            </div>
            <div>
              <label className={labelCls}>Сайт</label>
              <input type="url" value={form.website} onChange={set("website")} className={`${inputCls} mt-1`} placeholder="https://" />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={set("email")} className={`${inputCls} mt-1`} />
            </div>
            <div>
              <label className={labelCls}>Телефон</label>
              <input type="tel" value={form.phone} onChange={set("phone")} className={`${inputCls} mt-1`} />
            </div>
            <div>
              <label className={labelCls}>Контактное лицо</label>
              <input type="text" value={form.contact_name} onChange={set("contact_name")} className={`${inputCls} mt-1`} />
            </div>
            <div>
              <label className={labelCls}>Приоритет</label>
              <select value={form.priority} onChange={set("priority")} className={`${inputCls} mt-1`}>
                <option value="">—</option>
                <option value="1">1 — прямо под кейсы</option>
                <option value="2">2 — осторожнее</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Вариант письма</label>
            <select value={form.variant} onChange={set("variant")} className={`${inputCls} mt-1`}>
              <option value="">—</option>
              {VARIANTS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {formError && <p className="text-sm text-red-400">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Отмена</button>
            <button type="button" onClick={() => void save()} disabled={saving} className={btnPrimary}>
              {saving ? <Spinner /> : "Создать"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Импорт из таблицы">
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
            Откройте <span className="text-zinc-200">компании.xlsx</span>, выделите таблицу вместе с заголовками,
            скопируйте и вставьте сюда. Дубли по сайту или названию пропускаются. Первые письма
            распределятся по 5 в рабочий день, сначала приоритет 1.
          </p>
          <textarea
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setPreview(null);
            }}
            rows={6}
            className={`${inputCls} font-mono text-xs`}
            placeholder={"Компания\tГород\tСайт\t…"}
          />

          {preview && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-sm">
              <p className="text-zinc-200">Найдено компаний: {preview.items.length}</p>
              {preview.items.length > 0 && (
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {preview.items.slice(0, 5).map((i) => i.lead.company).join(", ")}
                  {preview.items.length > 5 ? "…" : ""}
                </p>
              )}
              {preview.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-amber-300">
                  {preview.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {importResult && <p className="text-sm text-brand-green">{importResult}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setImportOpen(false)} className={btnGhost}>Закрыть</button>
            {preview && preview.items.length > 0 ? (
              <button type="button" onClick={() => void runImport()} disabled={importing} className={btnPrimary}>
                {importing ? <Spinner /> : `Добавить ${preview.items.length}`}
              </button>
            ) : (
              <button type="button" onClick={parseImport} disabled={!importText.trim()} className={btnPrimary}>
                Разобрать
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function LeadRow({ lead: l, today }: { lead: Lead; today: string }) {
  const due = l.next_step_date ? dueLabel(l.next_step_date, today) : null;
  return (
    <li>
      <Link
        to={`/admin/crm/${l.id}`}
        className="block rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 transition hover:border-zinc-600"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate font-medium text-zinc-100">
            {l.priority === 1 && <span className="mr-1.5 text-brand-green" title="Приоритет 1">●</span>}
            {l.company}
          </span>
          <StageChip stage={l.stage} />
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
          <span className="truncate">
            {[l.city, l.next_step].filter(Boolean).join(" · ") || "—"}
          </span>
          {due && <span className={`shrink-0 ${due.overdue ? "text-red-400" : ""}`}>{due.text}</span>}
        </div>
      </Link>
    </li>
  );
}
