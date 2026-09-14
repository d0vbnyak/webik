import { useState } from "react";
import { Link } from "react-router";
import { usePeriod } from "../context/PeriodContext";
import { useExpenses } from "../hooks/useExpenses";
import { useCategories } from "../hooks/useCategories";
import type { Expense } from "../lib/types";
import { formatMoney, formatDate, todayISO } from "../lib/dates";
import MonthSwitcher from "../components/MonthSwitcher";
import Modal from "../components/Modal";
import MoneyInput from "../components/MoneyInput";
import CategorySelect from "../components/CategorySelect";
import ConfirmDelete from "../components/ConfirmDelete";
import Spinner from "../components/Spinner";
import { inputCls, labelCls, btnPrimary, btnGhost } from "../components/controls";

type FormState = { amount: number; date: string; category: string; comment: string };

const emptyForm = (category: string): FormState => ({
  amount: 0,
  date: todayISO(),
  category,
  comment: "",
});

export default function Expenses() {
  const { year, month } = usePeriod();
  const { expenses, total, loading, error, add, update, remove } = useExpenses(year, month);
  const { byType, addCategory } = useCategories();
  const expenseCats = byType("expense");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(""));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setForm(emptyForm(expenseCats[0]?.name ?? ""));
    setFormError(null);
    setOpen(true);
  }
  function openEdit(e: Expense) {
    setEditing(e);
    setForm({ amount: e.amount, date: e.date, category: e.category, comment: e.comment ?? "" });
    setFormError(null);
    setOpen(true);
  }

  async function save() {
    if (form.amount <= 0) return setFormError("Сумма должна быть больше нуля");
    if (!form.category) return setFormError("Выберите категорию");
    if (!form.date) return setFormError("Укажите дату");
    setSaving(true);
    const payload = {
      amount: form.amount,
      date: form.date,
      category: form.category,
      comment: form.comment.trim() || null,
      recurring_id: editing?.recurring_id ?? null,
    };
    const res = editing ? await update(editing.id, payload) : await add(payload);
    setSaving(false);
    if (res.error) setFormError(res.error);
    else setOpen(false);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Расходы</h1>
        <div className="flex items-center gap-2">
          <Link to="/admin/recurring" className={btnGhost}>
            Повторяющиеся
          </Link>
          <MonthSwitcher />
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-zinc-400">
          Итого за месяц: <span className="font-medium text-zinc-100">{formatMoney(total)}</span>
        </span>
        <button type="button" onClick={openNew} className={btnPrimary}>
          + Расход
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">Ошибка загрузки: {error}</p>}

      {loading ? (
        <div className="py-10 text-center"><Spinner /></div>
      ) : expenses.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">За этот месяц расходов нет.</p>
      ) : (
        <ul className="space-y-2">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-100">{formatMoney(e.amount)}</span>
                  <span className="truncate text-xs text-zinc-400">{e.category}</span>
                  {e.recurring_id && (
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">авто</span>
                  )}
                </div>
                <div className="text-xs text-zinc-500">
                  {formatDate(e.date)}
                  {e.comment ? ` · ${e.comment}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => openEdit(e)} className={btnGhost}>
                  Изм.
                </button>
                <ConfirmDelete onConfirm={() => void remove(e.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Редактировать расход" : "Новый расход"}>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Сумма, ₽</label>
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
                options={expenseCats}
                onAdd={(name) => addCategory("expense", name)}
              />
            </div>
          </div>
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
