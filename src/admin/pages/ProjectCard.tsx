import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useProject } from "../hooks/useProjects";
import { formatDate, formatMoney, todayISO } from "../lib/dates";
import {
  PROJECT_EVENT_TYPES,
  daysSince,
  defaultProjectStep,
  domainOf,
  dueText,
  eventLabel,
  normalizeUrl,
  projectStageLabel,
  slugError,
} from "../lib/projects";
import { nextStepError } from "../lib/crm";
import type { Project, ProjectEventType, ProjectStage } from "../lib/types";
import StageRail from "../components/StageRail";
import { DomainPair } from "../components/ProjectRow";
import Modal from "../components/Modal";
import MoneyInput from "../components/MoneyInput";
import Spinner from "../components/Spinner";
import ConfirmDelete from "../components/ConfirmDelete";
import { IconExternal, IconPlugin } from "../components/icons";
import { inputCls, labelCls, btnPrimary, btnGhost } from "../components/controls";

type StageForm = { stage: ProjectStage; nextStep: string; nextStepDate: string; comment: string };

const LINKS: { key: "source_url" | "design_artifact_url" | "demo_url" | "prod_url"; label: string }[] = [
  { key: "source_url", label: "Старый сайт" },
  { key: "design_artifact_url", label: "Макет" },
  { key: "demo_url", label: "Демо" },
  { key: "prod_url", label: "Прод" },
];

const FIELDS: { key: keyof Project; label: string; mono?: boolean; type?: string; area?: boolean }[] = [
  { key: "name", label: "Название" },
  { key: "slug", label: "slug", mono: true },
  { key: "source_url", label: "Старый сайт", mono: true, type: "url" },
  { key: "design_artifact_url", label: "Макет в Claude Design", mono: true, type: "url" },
  { key: "demo_url", label: "Демо", mono: true, type: "url" },
  { key: "prod_url", label: "Прод", mono: true, type: "url" },
  { key: "contact_name", label: "Контактное лицо" },
  { key: "phone", label: "Телефон", type: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "telegram_username", label: "Telegram (без @)" },
  { key: "note", label: "Заметка", area: true },
];

function Block({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const linkBtn = "text-xs text-zinc-500 transition-colors hover:text-zinc-200";

export default function ProjectCard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const today = todayISO();
  const { project, events, incomes, loading, error, update, addEvent, changeStage, removeEvent, remove } = useProject(id);

  const [stageForm, setStageForm] = useState<StageForm | null>(null);
  const [stepForm, setStepForm] = useState<{ text: string; date: string } | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string> | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [eventType, setEventType] = useState<Exclude<ProjectEventType, "stage" | "sync">>("call");
  const [eventText, setEventText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading) return <div className="py-16 text-center"><Spinner /></div>;
  if (error) return <p className="text-sm text-red-400">Ошибка загрузки: {error}</p>;
  if (!project) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500">
        Проект не найден. <Link to="/admin/projects" className="text-brand-green">К проектам</Link>
      </div>
    );
  }
  const p = project;

  function openStage(stage: ProjectStage) {
    const step = stage === p.stage ? { text: p.next_step ?? "", date: p.next_step_date ?? "" } : defaultProjectStep(stage, today);
    setStageForm({ stage, nextStep: step.text, nextStepDate: step.date, comment: "" });
    setFormError(null);
  }

  async function saveStage() {
    if (!stageForm) return;
    const err = nextStepError(stageForm.nextStep, stageForm.nextStepDate);
    if (err) return setFormError(err);
    setSaving(true);
    const res = await changeStage(
      stageForm.stage,
      { next_step: stageForm.nextStep.trim() || null, next_step_date: stageForm.nextStepDate || null },
      stageForm.comment.trim(),
    );
    setSaving(false);
    if (res.error && !res.partial) return setFormError(res.error);
    setActionError(res.error);
    setStageForm(null);
  }

  async function saveStep() {
    if (!stepForm) return;
    const err = nextStepError(stepForm.text, stepForm.date);
    if (err) return setFormError(err);
    setSaving(true);
    const res = await update({ next_step: stepForm.text.trim() || null, next_step_date: stepForm.date || null });
    setSaving(false);
    if (res.error) return setFormError(res.error);
    setStepForm(null);
  }

  function openEdit() {
    const form: Record<string, string> = {};
    for (const f of FIELDS) form[f.key] = String(p[f.key] ?? "");
    setEditForm(form);
    setAmount(p.amount);
    setFormError(null);
  }

  async function saveEdit() {
    if (!editForm) return;
    if (!editForm.name.trim()) return setFormError("Название не может быть пустым");
    const sErr = slugError(editForm.slug.trim());
    if (sErr) return setFormError(sErr);
    const patch: Partial<Project> = { amount };
    for (const f of FIELDS) {
      const v = editForm[f.key].trim();
      if (f.type === "url") {
        const u = normalizeUrl(v);
        if (u.error) return setFormError(`${f.label}: ${u.error}`);
        (patch as Record<string, unknown>)[f.key] = u.url;
      } else {
        (patch as Record<string, unknown>)[f.key] = f.key === "telegram_username" ? v.replace(/^@/, "") || null : v || null;
      }
    }
    patch.name = editForm.name.trim();
    patch.slug = editForm.slug.trim();
    setSaving(true);
    const res = await update(patch);
    setSaving(false);
    if (res.error) return setFormError(res.error);
    setEditForm(null);
  }

  async function saveEvent() {
    if (!eventText.trim()) return;
    setSaving(true);
    const res = await addEvent({ type: eventType, date: today, comment: eventText.trim() });
    setSaving(false);
    if (res.error) return setActionError(res.error);
    setEventText("");
  }

  async function deleteProject() {
    const res = await remove();
    if (res.error) return setActionError(res.error);
    navigate("/admin/projects");
  }

  async function toggleClosed() {
    const res = await update({ closed: !p.closed });
    if (res.error) return setActionError(res.error);
    await addEvent({ type: "note", date: today, comment: p.closed ? "Проект снова в работе" : "Проект закрыт без выкладки" });
  }

  const due = p.next_step_date ? dueText(p.next_step_date, today) : null;
  const paid = incomes.reduce((s, i) => s + i.paid_amount, 0);
  const billed = incomes.reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <Link to="/admin/projects" className="text-sm text-zinc-500 transition-colors hover:text-zinc-200">
        ← Проекты
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-zinc-100">{p.name}</h1>
          {p.closed && <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">закрыт</span>}
        </div>
        <DomainPair project={p} className="mt-1 text-[13px]" />
      </header>

      {actionError && <p className="mt-4 text-sm text-red-400">{actionError}</p>}

      <div className="mt-8">
        <StageRail stage={p.stage} closed={p.closed} labels onPick={openStage} />
        <div className="mt-3 flex flex-col gap-1 text-xs text-zinc-500 sm:flex-row sm:gap-4">
          <span className="flex items-center gap-1.5">
            <IconPlugin />
            {p.synced_at
              ? `Плагин обновил ${daysSince(p.synced_at, today) === 0 ? "сегодня" : `${daysSince(p.synced_at, today)} дн. назад`}`
              : "Плагин этот проект ещё не присылал"}
          </span>
          <span>
            На этапе «{projectStageLabel(p.stage)}» {daysSince(p.stage_changed_at, today)} дн.
          </span>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="space-y-10">
          <Block
            title="Следующий шаг"
            action={
              <button
                type="button"
                className={linkBtn}
                onClick={() => {
                  setStepForm({ text: p.next_step ?? "", date: p.next_step_date ?? "" });
                  setFormError(null);
                }}
              >
                Изменить
              </button>
            }
          >
            <div className={`rounded-xl border px-4 py-4 ${due?.overdue ? "border-red-500/30 bg-red-950/30" : "border-zinc-800/80 bg-zinc-900"}`}>
              {p.next_step ? (
                <>
                  <p className="text-[17px] leading-snug text-zinc-100">{p.next_step}</p>
                  {due && <p className={`mt-1.5 text-sm ${due.overdue ? "text-red-400" : "text-zinc-500"}`}>{due.text}</p>}
                </>
              ) : (
                <p className="text-sm text-zinc-500">Шаг не записан — проект не появится в «Сегодня».</p>
              )}
            </div>
          </Block>

          <Block title="Журнал">
            <form
              className="mb-4 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void saveEvent();
              }}
            >
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as typeof eventType)}
                aria-label="Тип записи"
                className={`${inputCls} sm:w-36`}
              >
                {PROJECT_EVENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <input
                value={eventText}
                onChange={(e) => setEventText(e.target.value)}
                placeholder="Что обсудили или решили"
                aria-label="Текст записи"
                className={inputCls}
              />
              <button type="submit" disabled={saving || !eventText.trim()} className={`${btnGhost} shrink-0`}>
                Записать
              </button>
            </form>
            {events.length === 0 ? (
              <p className="text-sm text-zinc-500">Записей пока нет.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-zinc-800 pl-5">
                {events.map((e) => (
                  <li key={e.id} className="group relative">
                    <span
                      className={`absolute -left-[24.5px] top-1.5 h-2 w-2 rounded-full ring-4 ring-zinc-950 ${
                        e.type === "stage" ? "bg-zinc-300" : "bg-zinc-700"
                      }`}
                    />
                    <div className="flex items-baseline gap-2 text-xs text-zinc-500">
                      <span className="tabular-nums">{formatDate(e.date)}</span>
                      <span>{eventLabel(e.type)}</span>
                      {e.type !== "stage" && (
                        <button
                          type="button"
                          onClick={() => void removeEvent(e.id).then((r) => r.error && setActionError(r.error))}
                          className="ml-auto text-zinc-600 opacity-100 transition-opacity hover:text-red-400 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
                          aria-label="Удалить запись"
                        >
                          удалить
                        </button>
                      )}
                    </div>
                    {e.comment && <p className="mt-0.5 text-sm text-zinc-200">{e.comment}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Block>
        </div>

        <aside className="space-y-10">
          <Block title="Ссылки" action={<button type="button" className={linkBtn} onClick={openEdit}>Изменить</button>}>
            <dl className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800/80">
              {LINKS.map((l) => {
                // Ссылки можно записать и в обход формы — в href только http(s)
                const url = p[l.key] && /^https?:\/\//i.test(p[l.key]!) ? p[l.key] : null;
                return (
                  <div key={l.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <dt className="text-sm text-zinc-400">{l.label}</dt>
                    <dd className="min-w-0">
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 font-mono text-xs text-zinc-200 hover:text-brand-green"
                        >
                          <span className="truncate">{l.key === "design_artifact_url" ? "Claude Design" : domainOf(url)}</span>
                          <IconExternal />
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Block>

          <Block title="Клиент">
            {p.contact_name || p.phone || p.email || p.telegram_username ? (
              <div className="space-y-1 text-sm">
                {p.contact_name && <div className="text-zinc-100">{p.contact_name}</div>}
                {p.phone && <a href={`tel:${p.phone}`} className="block text-zinc-300 hover:text-zinc-100">{p.phone}</a>}
                {p.email && <a href={`mailto:${p.email}`} className="block truncate text-zinc-300 hover:text-zinc-100">{p.email}</a>}
                {p.telegram_username && (
                  <a href={`https://t.me/${p.telegram_username}`} target="_blank" rel="noreferrer" className="block text-zinc-300 hover:text-zinc-100">
                    @{p.telegram_username}
                  </a>
                )}
              </div>
            ) : (
              <button type="button" onClick={openEdit} className="text-sm text-zinc-500 hover:text-zinc-300">
                + Добавить контакт
              </button>
            )}
            {p.note && <p className="mt-3 whitespace-pre-line text-sm text-zinc-400">{p.note}</p>}
          </Block>

          <Block title="Деньги">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-zinc-400">Стоимость</span>
              <span className="tabular-nums text-zinc-100">{p.amount != null ? formatMoney(p.amount) : "—"}</span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between text-sm">
              <span className="text-zinc-400">Получено</span>
              <span className="tabular-nums text-zinc-100">{formatMoney(paid)}</span>
            </div>
            {billed > paid && (
              <div className="mt-1.5 flex items-baseline justify-between text-sm">
                <span className="text-zinc-400">Ждём оплату</span>
                <span className="tabular-nums text-amber-400">{formatMoney(billed - paid)}</span>
              </div>
            )}
            <Link to="/admin/money/incomes" className="mt-3 inline-block text-xs text-zinc-500 hover:text-zinc-300">
              Привязать доход к проекту можно в «Деньги → Доходы»
            </Link>
          </Block>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void toggleClosed()} className={btnGhost}>
              {p.closed ? "Вернуть в работу" : "Закрыть без выкладки"}
            </button>
            <ConfirmDelete label="Удалить проект" onConfirm={() => void deleteProject()} />
          </div>
        </aside>
      </div>

      <Modal open={!!stageForm} onClose={() => setStageForm(null)} title={stageForm ? `Этап: ${projectStageLabel(stageForm.stage)}` : ""}>
        {stageForm && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveStage();
            }}
          >
            <StageRail stage={stageForm.stage} labels onPick={(s) => openStage(s)} />
            <label className="block">
              <span className={labelCls}>Следующий шаг</span>
              <input
                value={stageForm.nextStep}
                onChange={(e) => setStageForm({ ...stageForm, nextStep: e.target.value })}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Когда</span>
              <input
                type="date"
                value={stageForm.nextStepDate}
                onChange={(e) => setStageForm({ ...stageForm, nextStepDate: e.target.value })}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Комментарий в журнал</span>
              <input
                value={stageForm.comment}
                onChange={(e) => setStageForm({ ...stageForm, comment: e.target.value })}
                placeholder="Клиент одобрил макет"
                className={`${inputCls} mt-1`}
              />
            </label>
            {formError && <p className="text-sm text-red-400">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setStageForm(null)} className={btnGhost}>Отмена</button>
              <button type="submit" disabled={saving} className={btnPrimary}>{saving ? "Сохраняю…" : "Сохранить"}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!stepForm} onClose={() => setStepForm(null)} title="Следующий шаг">
        {stepForm && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveStep();
            }}
          >
            <label className="block">
              <span className={labelCls}>Что сделать</span>
              <input value={stepForm.text} onChange={(e) => setStepForm({ ...stepForm, text: e.target.value })} autoFocus className={`${inputCls} mt-1`} />
            </label>
            <label className="block">
              <span className={labelCls}>Когда</span>
              <input type="date" value={stepForm.date} onChange={(e) => setStepForm({ ...stepForm, date: e.target.value })} className={`${inputCls} mt-1`} />
            </label>
            {formError && <p className="text-sm text-red-400">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setStepForm(null)} className={btnGhost}>Отмена</button>
              <button type="submit" disabled={saving} className={btnPrimary}>{saving ? "Сохраняю…" : "Сохранить"}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!editForm} onClose={() => setEditForm(null)} title="Данные проекта">
        {editForm && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void saveEdit();
            }}
          >
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className={labelCls}>{f.label}</span>
                {f.area ? (
                  <textarea
                    rows={3}
                    value={editForm[f.key]}
                    onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                    className={`${inputCls} mt-1`}
                  />
                ) : (
                  <input
                    type={f.type === "url" ? "text" : (f.type ?? "text")}
                    inputMode={f.type === "url" ? "url" : undefined}
                    value={editForm[f.key]}
                    onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                    className={`${inputCls} mt-1 ${f.mono ? "font-mono text-sm" : ""}`}
                  />
                )}
                {f.key === "slug" && p.synced_at && editForm.slug.trim() !== p.slug && (
                  <span className="mt-1 block text-xs text-amber-400">
                    Плагин знает проект как «{p.slug}». Переименуйте и папку проекта, иначе плагин заведёт дубль.
                  </span>
                )}
              </label>
            ))}
            <label className="block">
              <span className={labelCls}>Стоимость работ</span>
              <div className="mt-1">
                <MoneyInput value={amount ?? 0} onChange={(v) => setAmount(v || null)} />
              </div>
            </label>
            {formError && <p className="text-sm text-red-400">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditForm(null)} className={btnGhost}>Отмена</button>
              <button type="submit" disabled={saving} className={btnPrimary}>{saving ? "Сохраняю…" : "Сохранить"}</button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
}
