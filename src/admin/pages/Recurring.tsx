import { useState } from "react";
import { useRecurring } from "../hooks/useRecurring";
import { useCategories } from "../hooks/useCategories";
import type { RecurringExpense } from "../lib/types";
import { formatMoney, formatDate, todayISO } from "../lib/dates";
import Modal from "../components/Modal";
import MoneyInput from "../components/MoneyInput";
import CategorySelect from "../components/CategorySelect";
import ConfirmDelete from "../components/ConfirmDelete";
import Spinner from "../components/Spinner";
import { inputCls, labelCls, btnPrimary, btnGhost } from "../components/controls";

type FormState = {
  name: string;
  amount: number;
  category: string;
  next_charge_date: string;
  reminder_days_before: number;
  active: boolean;
};

const emptyForm = (category: string): FormState => ({
  name: "",
  amount: 0,
  category,
  next_charge_date: todayISO(),
  reminder_days_before: 3,
  active: true,
});

export default function Recurring() {
  const { recurring, loading, error, add, update, remove } = useRecurring();
  const { byType, addCategory } = useCategories();
  const expenseCats = byType("expense");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(""));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setForm(emptyForm(expenseCats[0]?.name ?? ""));
    setFormError(null);
    setOpen(true);
  }
  function openEdit(r: RecurringExpense) {
    setEditing(r);
    setForm({
      name: r.name,
      amount: r.amount,
      category: r.category,
      next_charge_date: r.next_charge_date,
      reminder_days_before: r.reminder_days_before,
      active: r.active,
    });
    setFormError(null);
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return setFormError("Введите название");
    if (form.amount <= 0) return setFormError("Сумма должна быть больше нуля");
    if (!form.category) return setFormError("Выберите категорию");
    if (!form.next_charge_date) return setFormError("Укажите дату следующего списания");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      amount: form.amount,
      category: form.category,
      next_charge_date: form.next_charge_date,
      reminder_days_before: Math.max(0, Math.round(form.reminder_days_before)),
      active: form.active,
    };
    const res = editing ? await update(editing.id, payload) : await add(payload);
    setSaving(false);
    if (res.error) setFormError(res.error);
    else setOpen(false);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Повторяющиеся</h1>
        <button type="button" onClick={openNew} className={btnPrimary}>
          + Шаблон
        </button>
      </div>
      <p className="mb-4 text-sm text-zinc-500">
        Подписки и регулярные платежи. При входе в панель просроченные списания добавляются
        в расходы автоматически.
      </p>

      {error && <p className="mb-3 text-sm text-red-400">Ошибка загрузки: {error}</p>}

      {loading ? (
        <div className="py-10 text-center"><Spinner /></div>
      ) : recurring.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">Шаблонов пока нет.</p>
      ) : (
        <ul className="space-y-2">
          {recurring.map((r) => (
            <li
              key={r.id}
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                r.active ? "border-zinc-800 bg-zinc-900" : "border-zinc-800/60 bg-zinc-900/40 opacity-60"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-zinc-100">{r.name}</span>
                  <span className="text-xs text-zinc-400">{formatMoney(r.amount)}</span>
                </div>
                <div className="text-xs text-zinc-500">
                  {r.category} · следующее {formatDate(r.next_charge_date)} · напоминать за{" "}
                  {r.reminder_days_before} дн.
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => void update(r.id, { active: !r.active })}
                  className={btnGhost}
                >
                  {r.active ? "Выкл" : "Вкл"}
                </button>
                <button type="button" onClick={() => openEdit(r)} className={btnGhost}>
                  Изм.
                </button>
                <ConfirmDelete onConfirm={() => void remove(r.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Редактировать шаблон" : "Новый шаблон"}>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Название</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={`${inputCls} mt-1`}
              placeholder="Напр. Хостинг, ChatGPT"
            />
          </div>
          <div>
            <label className={labelCls}>Сумма, ₽</label>
            <div className="mt-1">
              <MoneyInput value={form.amount} onChange={(amount) => setForm((f) => ({ ...f, amount }))} />
            </div>
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
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>Дата следующего списания</label>
              <input
                type="date"
                value={form.next_charge_date}
                onChange={(e) => setForm((f) => ({ ...f, next_charge_date: e.target.value }))}
                className={`${inputCls} mt-1`}
              />
            </div>
            <div className="w-28">
              <label className={labelCls}>Напомнить за (дн.)</label>
              <input
                type="number"
                min={0}
                value={form.reminder_days_before}
                onChange={(e) => setForm((f) => ({ ...f, reminder_days_before: Number(e.target.value) }))}
                className={`${inputCls} mt-1`}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-4 w-4 accent-brand-green"
            />
            Активен
          </label>

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
