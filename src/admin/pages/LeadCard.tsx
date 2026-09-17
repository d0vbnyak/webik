import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useLead } from "../hooks/useLeads";
import {
  ALL_STAGES,
  LOST_REASONS,
  SOURCES,
  STAGES,
  TOUCH_TYPES,
  VARIANTS,
  buildStageChange,
  defaultNextStep,
  lostReasonLabel,
  nextStepError,
  stageAfterTouch,
  stageIndex,
  stageLabel,
  touchLabel,
} from "../lib/crm";
import { formatDate, formatMoney, todayISO } from "../lib/dates";
import type { Lead, LeadStage, LostReason, TouchType } from "../lib/types";
import Card from "../components/Card";
import Modal from "../components/Modal";
import MoneyInput from "../components/MoneyInput";
import Spinner from "../components/Spinner";
import StageChip from "../components/StageChip";
import ConfirmDelete from "../components/ConfirmDelete";
import OpenerDraftModal from "../components/OpenerDraftModal";
import { suggestOpener, type OpenerDraft } from "../lib/ai";
import { inputCls, labelCls, btnPrimary, btnGhost } from "../components/controls";

type StageForm = { stage: LeadStage; reason: LostReason | ""; nextStep: string; nextStepDate: string; comment: string };
type TouchForm = { type: TouchType; date: string; comment: string };

// Поля карточки компании, редактируемые в одной форме
const TEXT_FIELDS: { key: keyof Lead; label: string; type?: string; area?: boolean }[] = [
  { key: "company", label: "Компания" },
  { key: "inn", label: "ИНН" },
  { key: "city", label: "Город" },
  { key: "website", label: "Сайт", type: "url" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Телефон", type: "tel" },
  { key: "contact_name", label: "Контактное лицо" },
  { key: "telegram_username", label: "Telegram (без @)" },
  { key: "other_channels", label: "Другие каналы" },
  { key: "business", label: "Чем занимаются", area: true },
  { key: "hook", label: "Зацепка с сайта", area: true },
  { key: "first_line", label: "Первая строка письма", area: true },
];

export default function LeadCard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const today = todayISO();
  const {
    lead,
    touches,
    clientIncome,
    incomeError,
    loading,
    error,
    update,
    addTouch,
    removeTouch,
    changeStage,
    remove,
    makeClient,
  } = useLead(id);

  const [stageOpen, setStageOpen] = useState(false);
  const [stageForm, setStageForm] = useState<StageForm | null>(null);
  const [touchOpen, setTouchOpen] = useState(false);
  const [touchForm, setTouchForm] = useState<TouchForm>({ type: "email", date: today, comment: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [makingClient, setMakingClient] = useState(false);
  const [aiDraft, setAiDraft] = useState<OpenerDraft | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // Номер текущего запроса: ответ на запрос, после которого окно закрыли, не показываем
  const aiRequest = useRef(0);

  if (loading) return <div className="py-10 text-center"><Spinner /></div>;
  if (error) return <p className="text-sm text-red-400">Ошибка загрузки: {error}</p>;
  if (!lead) {
    return (
      <div className="py-10 text-center text-sm text-zinc-500">
        Лид не найден. <Link to="/admin/crm" className="text-brand-green">К воронке</Link>
      </div>
    );
  }

  /** Для текущего этапа — его шаг как есть, для нового — шаг по умолчанию. */
  function stepFor(stage: LeadStage) {
    if (stage === lead!.stage) return { text: lead!.next_step ?? "", date: lead!.next_step_date ?? "" };
    return defaultNextStep(stage, today);
  }

  function openStage(stage: LeadStage = lead!.stage) {
    const next = stepFor(stage);
    setStageForm({
      stage,
      reason: stage === lead!.stage ? (lead!.lost_reason ?? "") : "",
      nextStep: next.text,
      nextStepDate: next.date,
      comment: "",
    });
    setFormError(null);
    setStageOpen(true);
  }

  function pickStage(stage: LeadStage) {
    const next = stepFor(stage);
    setStageForm((f) => f && { ...f, stage, nextStep: next.text, nextStepDate: next.date });
  }

  async function saveStage() {
    if (!stageForm || !lead) return;
    const built = buildStageChange(lead, stageForm.stage, {
      lostReason: stageForm.reason || null,
      nextStep: stageForm.nextStep,
      nextStepDate: stageForm.nextStepDate,
    });
    if (!built.patch) return setFormError(built.error);
    const parts = [`${stageLabel(lead.stage)} → ${stageLabel(stageForm.stage)}`];
    if (stageForm.stage === "lost") parts.push(`причина: ${lostReasonLabel(stageForm.reason || null)}`);
    if (stageForm.comment.trim()) parts.push(stageForm.comment.trim());
    setSaving(true);
    const res = await changeStage(built.patch, parts.join(" · "));
    setSaving(false);
    if (res.error && !res.partial) return setFormError(res.error);
    // Частичная запись — модалку закрываем, чтобы повтор не задвоил историю
    setActionError(res.error);
    setStageOpen(false);
  }

  function openTouch() {
    setTouchForm({ type: lead!.stage === "sent" ? "followup" : "email", date: today, comment: "" });
    setFormError(null);
    setTouchOpen(true);
  }

  const touchMovesTo = stageAfterTouch(lead.stage, touchForm.type);

  async function saveTouch() {
    if (!lead) return;
    if (!touchForm.date) return setFormError("Укажите дату");
    if (touchForm.type === "note" && !touchForm.comment.trim()) return setFormError("Напишите заметку");
    setSaving(true);
    const res = await addTouch({ type: touchForm.type, date: touchForm.date, comment: touchForm.comment.trim() || null });
    if (res.error) {
      setSaving(false);
      return setFormError(res.error);
    }
    // Касание уже записано: дальше модалка закрывается при любом исходе,
    // иначе повторное «Записать» задвоит касание
    let followUpError: string | null = null;
    if (touchMovesTo) {
      // Касание двигает этап — следующий шаг считается от даты касания
      const next = defaultNextStep(touchMovesTo, touchForm.date);
      const built = buildStageChange(lead, touchMovesTo, { nextStep: next.text, nextStepDate: next.date });
      if (built.patch) {
        const moved = await changeStage(
          built.patch,
          `${stageLabel(lead.stage)} → ${stageLabel(touchMovesTo)} · по касанию «${touchLabel(touchForm.type)}»`,
        );
        if (moved.error) {
          followUpError = moved.partial ? moved.error : `Касание записано, но этап не сменился: ${moved.error}`;
        }
      }
    }
    setSaving(false);
    setActionError(followUpError);
    setTouchOpen(false);
  }

  function openEdit() {
    const f: Record<string, string> = {};
    for (const { key } of TEXT_FIELDS) f[key] = String(lead![key] ?? "");
    f.source = lead!.source ?? "";
    f.variant = lead!.variant ?? "";
    f.priority = lead!.priority ? String(lead!.priority) : "";
    f.deal_amount = lead!.deal_amount ? String(lead!.deal_amount) : "0";
    f.next_step = lead!.next_step ?? "";
    f.next_step_date = lead!.next_step_date ?? "";
    setEditForm(f);
    setFormError(null);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editForm.company?.trim()) return setFormError("Введите название компании");
    const stepError = nextStepError(editForm.next_step, editForm.next_step_date);
    if (stepError) return setFormError(stepError);
    const patch: Record<string, unknown> = {};
    for (const { key } of TEXT_FIELDS) {
      const v = editForm[key].trim();
      patch[key] =
        key === "telegram_username"
          ? v.replace(/^(https?:\/\/)?(t\.me|telegram\.me)\//i, "").replace(/^@/, "") || null
          : v || null;
    }
    patch.company = editForm.company.trim();
    patch.source = editForm.source || null;
    patch.variant = editForm.variant || null;
    patch.priority = editForm.priority ? Number(editForm.priority) : null;
    const amount = Number(editForm.deal_amount);
    patch.deal_amount = amount > 0 ? amount : null;
    patch.next_step = editForm.next_step.trim() || null;
    patch.next_step_date = editForm.next_step_date || null;
    setSaving(true);
    const res = await update(patch as Partial<Lead>);
    setSaving(false);
    if (res.error) return setFormError(res.error);
    setEditOpen(false);
  }

  async function doneNextStep() {
    setActionError(null);
    const res = await update({ next_step: null, next_step_date: null });
    if (res.error) setActionError(res.error);
  }

  async function toClient() {
    setActionError(null);
    setMakingClient(true);
    const res = await makeClient();
    setMakingClient(false);
    if (res.error) setActionError(res.error);
  }

  async function deleteTouch(touchId: string) {
    setActionError(null);
    const res = await removeTouch(touchId);
    if (res.error) setActionError(`Не удалось удалить запись: ${res.error}`);
  }

  async function deleteLead() {
    const res = await remove();
    if (res.error) setActionError(res.error);
    else navigate("/admin/crm");
  }

  async function copyFirstLine() {
    if (!lead?.first_line) return;
    try {
      await navigator.clipboard.writeText(lead.first_line);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setActionError("Не удалось скопировать — выделите текст вручную");
    }
  }

  async function askOpener() {
    if (!lead || aiLoading) return;
    const request = ++aiRequest.current;
    setAiLoading(true);
    setAiError(null);
    const res = await suggestOpener(lead.id);
    if (request !== aiRequest.current) return;
    setAiLoading(false);
    if (res.error !== null) return setAiError(res.error);
    setAiDraft(res.data);
  }

  function closeOpener() {
    aiRequest.current += 1;
    setAiLoading(false);
    setAiDraft(null);
    setAiError(null);
  }

  const nextOverdue = lead.next_step_date ? lead.next_step_date < today : false;
  const websiteHref = lead.website && !/^https?:\/\//i.test(lead.website) ? `https://${lead.website}` : lead.website;

  return (
    <div className="space-y-4">
      <Link to="/admin/crm" className="text-sm text-zinc-400 transition hover:text-zinc-200">
        ← Воронка
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words font-display text-2xl font-semibold tracking-tight">{lead.company}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <StageChip stage={lead.stage} />
            {lead.stage === "lost" && <span className="text-red-400">{lostReasonLabel(lead.lost_reason)}</span>}
            {lead.priority && <span>приоритет {lead.priority}</span>}
            {lead.city && <span>{lead.city}</span>}
            {lead.source && <span>{lead.source}</span>}
          </div>
        </div>
        <button type="button" onClick={openEdit} className={btnGhost}>
          Изменить
        </button>
      </div>

      {actionError && <p className="text-sm text-red-400">{actionError}</p>}

      {/* Главное действие — что делать дальше */}
      <Card className={nextOverdue ? "border-red-900/60" : ""}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">Следующий шаг</div>
            {lead.next_step ? (
              <>
                <div className="mt-0.5 text-zinc-100">{lead.next_step}</div>
                {lead.next_step_date && (
                  <div className={`text-xs ${nextOverdue ? "text-red-400" : "text-zinc-400"}`}>
                    {formatDate(lead.next_step_date)}
                    {nextOverdue ? " · просрочено" : ""}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-0.5 text-sm text-zinc-500">Не задан — лид выпадет из «Сегодня»</div>
            )}
          </div>
          {lead.next_step && (
            <button type="button" onClick={() => void doneNextStep()} className={btnGhost}>
              Снять
            </button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={openTouch} className={btnPrimary}>
            + Касание
          </button>
          <button type="button" onClick={() => openStage()} className={btnGhost}>
            Сменить этап
          </button>
        </div>
      </Card>

      {/* Прогресс по воронке */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ol className="flex min-w-max gap-1">
          {STAGES.map((s) => {
            const reached = stageIndex(lead.reached_stage) >= stageIndex(s.id);
            const current = lead.stage === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => openStage(s.id)}
                  className={`rounded-md px-2 py-1 text-[11px] transition ${
                    current
                      ? "bg-brand-green text-black"
                      : reached
                        ? "bg-brand-green/15 text-brand-green hover:bg-brand-green/25"
                        : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {s.label}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-display text-base font-semibold">Контакты</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="Контакт">{lead.contact_name}</Row>
            <Row label="Email">
              {lead.email && <a href={`mailto:${lead.email}`} className="text-brand-green hover:underline">{lead.email}</a>}
            </Row>
            <Row label="Телефон">
              {lead.phone && <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className="text-brand-green hover:underline">{lead.phone}</a>}
            </Row>
            <Row label="Telegram">
              {lead.telegram_username && (
                <a href={`https://t.me/${lead.telegram_username}`} target="_blank" rel="noopener noreferrer" className="text-brand-green hover:underline">
                  @{lead.telegram_username}
                </a>
              )}
            </Row>
            <Row label="Сайт">
              {websiteHref && (
                <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="break-all text-brand-green hover:underline">
                  {lead.website}
                </a>
              )}
            </Row>
            <Row label="Ещё">{lead.other_channels}</Row>
            <Row label="ИНН">{lead.inn}</Row>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-2 font-display text-base font-semibold">Сделка</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="Сумма">{lead.deal_amount ? formatMoney(lead.deal_amount) : null}</Row>
            <Row label="Клиент">
              {lead.client_id ? (
                <Link to="/admin/clients" className="text-brand-green hover:underline">создан</Link>
              ) : null}
            </Row>
            {incomeError && <Row label="Доходы"><span className="text-red-400">не загрузились</span></Row>}
            {clientIncome && (
              <Row label="Доходы">
                {formatMoney(clientIncome.amount)}
                <span className="text-zinc-500"> · получено {formatMoney(clientIncome.paid)}</span>
              </Row>
            )}
          </dl>
          {!lead.client_id && (
            <div className="mt-3">
              <button type="button" onClick={() => void toClient()} disabled={makingClient} className={`${btnGhost} disabled:opacity-60`}>
                {makingClient ? <Spinner /> : "Сделать клиентом"}
              </button>
              <p className="mt-1 text-xs text-zinc-500">
                Создаст запись в «Клиентах», к ней привязываются доходы. Обычно — когда подписан
                договор (этап «Пилот»).
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 className="font-display text-base font-semibold">Для письма</h2>
          <button
            type="button"
            onClick={() => void askOpener()}
            disabled={!lead.website || aiLoading}
            className={`${btnGhost} shrink-0 disabled:opacity-50`}
          >
            {aiLoading ? <><Spinner /> Читаю сайт…</> : lead.first_line ? "ИИ: другой вариант" : "ИИ: первая строка"}
          </button>
        </div>
        {!lead.website && <p className="mb-2 text-xs text-zinc-500">Чтобы ИИ предложил первую строку, добавьте сайт в карточке.</p>}
        {aiLoading && <p className="mb-2 text-xs text-zinc-500">Обычно 10–40 секунд: сервер читает сайт, модель ищет зацепку.</p>}
        {aiError && !aiDraft && <p className="mb-2 text-sm text-red-400">{aiError}</p>}
        {lead.business || lead.hook || lead.variant ? (
          <dl className="space-y-2 text-sm">
            <Row label="Вариант">{lead.variant}</Row>
            <Row label="Чем заняты">{lead.business}</Row>
            <Row label="Зацепка">{lead.hook}</Row>
          </dl>
        ) : (
          !lead.first_line && <p className="text-sm text-zinc-500">Зацепки и первой строки пока нет.</p>
        )}
        {lead.first_line && (
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <p className="whitespace-pre-line text-sm text-zinc-200">{lead.first_line}</p>
            <button type="button" onClick={() => void copyFirstLine()} className={`${btnGhost} mt-2`}>
              {copied ? "Скопировано" : "Копировать первую строку"}
            </button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-display text-base font-semibold">История</h2>
        {touches.length === 0 ? (
          <p className="py-2 text-sm text-zinc-500">Касаний пока нет.</p>
        ) : (
          <ul className="space-y-2">
            {touches.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 border-b border-zinc-800/60 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0 text-sm">
                  <div className="text-xs text-zinc-500">
                    {formatDate(t.date)} · <span className={t.type === "stage" ? "text-amber-300" : "text-zinc-300"}>{touchLabel(t.type)}</span>
                  </div>
                  {t.comment && <div className="whitespace-pre-line break-words text-zinc-200">{t.comment}</div>}
                </div>
                <ConfirmDelete onConfirm={() => void deleteTouch(t.id)} label="✕" />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex justify-end">
        <ConfirmDelete onConfirm={() => void deleteLead()} label="Удалить лид" />
      </div>

      {/* Черновик первой строки от ИИ */}
      <OpenerDraftModal
        lead={lead}
        draft={aiDraft}
        onClose={closeOpener}
        onRetry={() => void askOpener()}
        retrying={aiLoading}
        retryError={aiDraft ? aiError : null}
        onSave={async (patch) => {
          const res = await update(patch);
          return { error: res.error ?? null };
        }}
      />

      {/* Смена этапа */}
      <Modal open={stageOpen} onClose={() => setStageOpen(false)} title="Сменить этап">
        {stageForm && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Этап</label>
              <select
                value={stageForm.stage}
                onChange={(e) => pickStage(e.target.value as LeadStage)}
                className={`${inputCls} mt-1`}
              >
                {ALL_STAGES.map((s) => (
                  <option key={s} value={s}>{stageLabel(s)}</option>
                ))}
              </select>
            </div>
            {stageForm.stage === "lost" && (
              <div>
                <label className={labelCls}>Причина отказа</label>
                <select
                  value={stageForm.reason}
                  onChange={(e) => setStageForm((f) => f && { ...f, reason: e.target.value as LostReason | "" })}
                  className={`${inputCls} mt-1`}
                >
                  <option value="">— выберите —</option>
                  {LOST_REASONS.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>
                {stageForm.stage === "lost" ? "Когда вернуться (необязательно)" : "Следующий шаг"}
              </label>
              <input
                type="text"
                value={stageForm.nextStep}
                onChange={(e) => setStageForm((f) => f && { ...f, nextStep: e.target.value })}
                className={`${inputCls} mt-1`}
                placeholder={stageForm.stage === "lost" ? "напр. Написать снова после сезона" : ""}
              />
              <input
                type="date"
                value={stageForm.nextStepDate}
                onChange={(e) => setStageForm((f) => f && { ...f, nextStepDate: e.target.value })}
                className={`${inputCls} mt-2`}
              />
            </div>
            <div>
              <label className={labelCls}>Комментарий в историю</label>
              <input
                type="text"
                value={stageForm.comment}
                onChange={(e) => setStageForm((f) => f && { ...f, comment: e.target.value })}
                className={`${inputCls} mt-1`}
                placeholder={stageForm.stage === "lost" ? "что сказали, дословно" : "необязательно"}
              />
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setStageOpen(false)} className={btnGhost}>Отмена</button>
              <button type="button" onClick={() => void saveStage()} disabled={saving} className={btnPrimary}>
                {saving ? <Spinner /> : "Сохранить"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Новое касание */}
      <Modal open={touchOpen} onClose={() => setTouchOpen(false)} title="Касание">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Что было</label>
              <select
                value={touchForm.type}
                onChange={(e) => setTouchForm((f) => ({ ...f, type: e.target.value as TouchType }))}
                className={`${inputCls} mt-1`}
              >
                {TOUCH_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Дата</label>
              <input
                type="date"
                value={touchForm.date}
                onChange={(e) => setTouchForm((f) => ({ ...f, date: e.target.value }))}
                className={`${inputCls} mt-1`}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Комментарий</label>
            <textarea
              value={touchForm.comment}
              onChange={(e) => setTouchForm((f) => ({ ...f, comment: e.target.value }))}
              rows={3}
              className={`${inputCls} mt-1`}
              placeholder="что обсудили, что обещали"
            />
          </div>
          {touchMovesTo && touchForm.date && (
            <p className="rounded-lg bg-brand-green/10 px-3 py-2 text-xs text-brand-green">
              Этап сменится на «{stageLabel(touchMovesTo)}». Следующий шаг: {defaultNextStep(touchMovesTo, touchForm.date).text},{" "}
              {formatDate(defaultNextStep(touchMovesTo, touchForm.date).date)}.
            </p>
          )}

          {formError && <p className="text-sm text-red-400">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setTouchOpen(false)} className={btnGhost}>Отмена</button>
            <button type="button" onClick={() => void saveTouch()} disabled={saving} className={btnPrimary}>
              {saving ? <Spinner /> : "Записать"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Редактирование карточки */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Карточка компании">
        <div className="space-y-3">
          {TEXT_FIELDS.map((f) => (
            <div key={f.key}>
              <label className={labelCls}>{f.label}</label>
              {f.area ? (
                <textarea
                  value={editForm[f.key] ?? ""}
                  onChange={(e) => setEditForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  rows={2}
                  className={`${inputCls} mt-1`}
                />
              ) : (
                <input
                  type={f.type ?? "text"}
                  value={editForm[f.key] ?? ""}
                  onChange={(e) => setEditForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  className={`${inputCls} mt-1`}
                />
              )}
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Приоритет</label>
              <select
                value={editForm.priority ?? ""}
                onChange={(e) => setEditForm((s) => ({ ...s, priority: e.target.value }))}
                className={`${inputCls} mt-1`}
              >
                <option value="">—</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Откуда</label>
              <select
                value={editForm.source ?? ""}
                onChange={(e) => setEditForm((s) => ({ ...s, source: e.target.value }))}
                className={`${inputCls} mt-1`}
              >
                <option value="">—</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Вариант письма</label>
            <select
              value={editForm.variant ?? ""}
              onChange={(e) => setEditForm((s) => ({ ...s, variant: e.target.value }))}
              className={`${inputCls} mt-1`}
            >
              <option value="">—</option>
              {VARIANTS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Сумма сделки, ₽</label>
            <div className="mt-1">
              <MoneyInput
                value={Number(editForm.deal_amount ?? 0)}
                onChange={(v) => setEditForm((s) => ({ ...s, deal_amount: String(v) }))}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Следующий шаг</label>
            <input
              type="text"
              value={editForm.next_step ?? ""}
              onChange={(e) => setEditForm((s) => ({ ...s, next_step: e.target.value }))}
              className={`${inputCls} mt-1`}
            />
            <input
              type="date"
              value={editForm.next_step_date ?? ""}
              onChange={(e) => setEditForm((s) => ({ ...s, next_step_date: e.target.value }))}
              className={`${inputCls} mt-2`}
            />
          </div>

          {formError && <p className="text-sm text-red-400">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setEditOpen(false)} className={btnGhost}>Отмена</button>
            <button type="button" onClick={() => void saveEdit()} disabled={saving} className={btnPrimary}>
              {saving ? <Spinner /> : "Сохранить"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words text-zinc-200">{children}</dd>
    </div>
  );
}
