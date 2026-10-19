import { useState } from "react";
import { usePeriod } from "../context/PeriodContext";
import { useIncomes } from "../hooks/useIncomes";
import { useReceivables } from "../hooks/useReceivables";
import { useCategories } from "../hooks/useCategories";
import { useClients } from "../hooks/useClients";
import { useProjects } from "../hooks/useProjects";
import type { Income, PaymentStatus } from "../lib/types";
import { formatMoney, formatDate, todayISO } from "../lib/dates";
import { remainingToPay, isOverdue, normalizePaidAmount } from "../lib/finance";
import MonthSwitcher from "../components/MonthSwitcher";
import Modal from "../components/Modal";
import MoneyInput from "../components/MoneyInput";
import CategorySelect from "../components/CategorySelect";
import ConfirmDelete from "../components/ConfirmDelete";
import Spinner from "../components/Spinner";
import Card from "../components/Card";
import { inputCls, labelCls, btnPrimary, btnGhost } from "../components/controls";

const STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: "Оплачено",
  unpaid: "Не оплачено",
  partial: "Частично",
};

type FormState = {
  amount: number;
  date: string;
  category: string;
  client_id: string;
  project_id: string;
  comment: string;
  payment_status: PaymentStatus;
  paid_amount: number;
  due_date: string;
};

const emptyForm = (category: string): FormState => ({
  amount: 0,
  date: todayISO(),
  category,
  client_id: "",
  project_id: "",
  comment: "",
  payment_status: "unpaid",
  paid_amount: 0,
  due_date: "",
});

type Filter = "all" | PaymentStatus;

export default function Incomes() {
  const today = todayISO();
  const { year, month } = usePeriod();
  const incomesHook = useIncomes(year, month);
  const receivables = useReceivables();
  const { byType, addCategory } = useCategories();
  const { clients } = useClients();
  const { projects } = useProjects();
  const incomeCats = byType("income");

  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(""));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? null;

  function openNew() {
    setEditing(null);
    setForm(emptyForm(incomeCats[0]?.name ?? ""));
    setFormError(null);
    setOpen(true);
  }
  function openEdit(i: Income) {
    setEditing(i);
    setForm({
      amount: i.amount,
      date: i.date,
      category: i.category,
      client_id: i.client_id ?? "",
      project_id: i.project_id ?? "",
      comment: i.comment ?? "",
      payment_status: i.payment_status,
      paid_amount: i.paid_amount,
      due_date: i.due_date ?? "",
    });
    setFormError(null);
    setOpen(true);
  }

  async function save() {
    if (form.amount <= 0) return setFormError("Сумма должна быть больше нуля");
    if (!form.category) return setFormError("Выберите категорию");
    if (!form.date) return setFormError("Укажите дату");
    const paid = normalizePaidAmount(form.payment_status, form.amount, form.paid_amount);
    if (form.payment_status === "partial" && (paid <= 0 || paid >= form.amount)) {
      return setFormError("При частичной оплате укажите сумму больше 0 и меньше полной");
    }
    setSaving(true);
    const payload = {
      amount: form.amount,
      date: form.date,
      category: form.category,
      client_id: form.client_id || null,
      project_id: form.project_id || null,
      payment_status: form.payment_status,
      paid_amount: paid,
      due_date: form.due_date || null,
      comment: form.comment.trim() || null,
    };
    const res = editing ? await incomesHook.update(editing.id, payload) : await incomesHook.add(payload);
    setSaving(false);
    if (res.error) return setFormError(res.error);
    await receivables.reload();
    setOpen(false);
  }

  async function markPaidMonth(i: Income) {
    await incomesHook.markPaid(i.id, i.amount);
    await receivables.reload();
  }
  async function markPaidWidget(i: Income) {
    await receivables.markPaid(i.id, i.amount);
    await incomesHook.reload();
  }

  const visible = incomesHook.incomes.filter((i) => filter === "all" || i.payment_status === filter);
  const monthTotal = incomesHook.incomes.reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Доходы</h1>
        <MonthSwitcher />
      </div>

      {/* Дебиторка */}
      <Card className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Кто должен</h2>
          <span className="text-xs text-zinc-400">
            всего {formatMoney(receivables.items.reduce((s, i) => s + remainingToPay(i), 0))}
          </span>
        </div>
        {receivables.loading ? (
          <div className="py-4 text-center"><Spinner /></div>
        ) : receivables.items.length === 0 ? (
          <p className="py-2 text-sm text-zinc-500">Все доходы оплачены.</p>
        ) : (
          <ul className="space-y-2">
            {receivables.items.map((i) => {
              const overdue = isOverdue(i, today);
              return (
                <li
                  key={i.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                    overdue ? "border-red-900/60 bg-red-950/20" : "border-zinc-800 bg-zinc-950/40"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-100">
                      {formatMoney(remainingToPay(i))}
                      <span className="text-xs text-zinc-500"> из {formatMoney(i.amount)}</span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {clientName(i.client_id) ?? i.category}
                      {i.due_date ? ` · до ${formatDate(i.due_date)}` : ""}
                      {overdue ? " · просрочено" : ""}
                    </div>
                  </div>
                  <button type="button" onClick={() => void markPaidWidget(i)} className={btnGhost}>
                    Оплачено
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-zinc-400">
          Доход за месяц: <span className="font-medium text-zinc-100">{formatMoney(monthTotal)}</span>
        </span>
        <button type="button" onClick={openNew} className={btnPrimary}>
          + Доход
        </button>
      </div>

      {/* Фильтр по статусу */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", "paid", "partial", "unpaid"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              filter === f ? "bg-brand-green text-black" : "border border-zinc-700 text-zinc-300 hover:text-zinc-100"
            }`}
          >
            {f === "all" ? "Все" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {incomesHook.error && <p className="mb-3 text-sm text-red-400">Ошибка загрузки: {incomesHook.error}</p>}

      {incomesHook.loading ? (
        <div className="py-10 text-center"><Spinner /></div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">Доходов нет.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((i) => {
            const overdue = isOverdue(i, today);
            return (
              <li
                key={i.id}
                className={`rounded-xl border px-4 py-3 ${
                  overdue ? "border-red-900/60 bg-red-950/15" : "border-zinc-800 bg-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-100">{formatMoney(i.amount)}</span>
                      <span className="truncate text-xs text-zinc-400">{i.category}</span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {formatDate(i.date)}
                      {clientName(i.client_id) ? ` · ${clientName(i.client_id)}` : ""}
                      {i.comment ? ` · ${i.comment}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => openEdit(i)} className={btnGhost}>
                      Изм.
                    </button>
                    <ConfirmDelete onConfirm={() => void incomesHook.remove(i.id)} />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      i.payment_status === "paid"
                        ? "bg-brand-green/15 text-brand-green"
                        : overdue
                          ? "bg-red-500/15 text-red-400"
                          : "bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    {STATUS_LABEL[i.payment_status]}
                    {i.payment_status === "partial" ? ` · ${formatMoney(remainingToPay(i))} осталось` : ""}
                    {overdue ? " · просрочено" : ""}
                    {i.due_date && i.payment_status !== "paid" ? ` · до ${formatDate(i.due_date)}` : ""}
                  </span>
                  {i.payment_status !== "paid" && (
                    <button type="button" onClick={() => void markPaidMonth(i)} className={btnGhost}>
                      Оплачено
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Редактировать доход" : "Новый доход"}>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Сумма (полная стоимость), ₽</label>
            <div className="mt-1">
              <MoneyInput value={form.amount} onChange={(amount) => setForm((f) => ({ ...f, amount }))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Дата</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className={`${inputCls} mt-1`}
            />
          </div>
          <div>
            <label className={labelCls}>Категория</label>
            <div className="mt-1">
              <CategorySelect
                value={form.category}
                onChange={(category) => setForm((f) => ({ ...f, category }))}
                options={incomeCats}
                onAdd={(name) => addCategory("income", name)}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Клиент</label>
            <select
              value={form.client_id}
              onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
              className={`${inputCls} mt-1`}
            >
              <option value="">— не указан —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {projects.length > 0 && (
            <div>
              <label className={labelCls}>Проект</label>
              <select
                value={form.project_id}
                onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
                className={`${inputCls} mt-1`}
              >
                <option value="">— не указан —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Статус оплаты</label>
            <select
              value={form.payment_status}
              onChange={(e) =>
                setForm((f) => ({ ...f, payment_status: e.target.value as PaymentStatus }))
              }
              className={`${inputCls} mt-1`}
            >
              <option value="unpaid">Не оплачено</option>
              <option value="partial">Частично</option>
              <option value="paid">Оплачено</option>
            </select>
          </div>
          {form.payment_status === "partial" && (
            <div>
              <label className={labelCls}>Оплачено, ₽</label>
              <div className="mt-1">
                <MoneyInput
                  value={form.paid_amount}
                  onChange={(paid_amount) => setForm((f) => ({ ...f, paid_amount }))}
                />
              </div>
            </div>
          )}
          {form.payment_status !== "paid" && (
            <div>
              <label className={labelCls}>Ожидаемая дата оплаты</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className={`${inputCls} mt-1`}
              />
            </div>
          )}
          <div>
            <label className={labelCls}>Комментарий</label>
            <input
              type="text"
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              className={`${inputCls} mt-1`}
              placeholder="необязательно"
            />
          </div>

          {formError && <p className="text-sm text-red-400">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
              Отмена
            </button>
            <button type="button" onClick={() => void save()} disabled={saving} className={btnPrimary}>
              {saving ? <Spinner /> : "Сохранить"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
