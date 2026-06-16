import { useState } from "react";
import { useClients } from "../hooks/useClients";
import type { Client } from "../lib/types";
import Modal from "../components/Modal";
import ConfirmDelete from "../components/ConfirmDelete";
import MessengerButtons from "../components/MessengerButtons";
import Spinner from "../components/Spinner";
import { inputCls, labelCls, btnPrimary, btnGhost } from "../components/controls";

type FormState = {
  name: string;
  phone: string;
  telegram_username: string;
  max_link: string;
};

const emptyForm: FormState = { name: "", phone: "", telegram_username: "", max_link: "" };

export default function Clients() {
  const { clients, loading, error, add, update, remove } = useClients();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setOpen(true);
  }
  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      telegram_username: c.telegram_username ?? "",
      max_link: c.max_link ?? "",
    });
    setFormError(null);
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return setFormError("Введите имя клиента");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      telegram_username: form.telegram_username.trim().replace(/^@/, "") || null,
      max_link: form.max_link.trim() || null,
    };
    const res = editing ? await update(editing.id, payload) : await add(payload);
    setSaving(false);
    if (res.error) setFormError(res.error);
    else setOpen(false);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Клиенты</h1>
        <button type="button" onClick={openNew} className={btnPrimary}>
          + Клиент
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">Ошибка загрузки: {error}</p>}

      {loading ? (
        <div className="py-10 text-center"><Spinner /></div>
      ) : clients.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">Клиентов пока нет.</p>
      ) : (
        <ul className="space-y-2">
          {clients.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-zinc-100">{c.name}</div>
                <div className="truncate text-xs text-zinc-500">
                  {c.phone ?? ""}
                  {c.telegram_username ? ` · @${c.telegram_username}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <MessengerButtons
                  phone={c.phone}
                  telegram_username={c.telegram_username}
                  max_link={c.max_link}
                />
                <button type="button" onClick={() => openEdit(c)} className={btnGhost}>
                  Изм.
                </button>
                <ConfirmDelete onConfirm={() => void remove(c.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Редактировать клиента" : "Новый клиент"}>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Имя</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={`${inputCls} mt-1`}
              placeholder="Обязательно"
            />
          </div>
          <div>
            <label className={labelCls}>Телефон</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className={`${inputCls} mt-1`}
              placeholder="напр. 8 900 123-45-67"
            />
          </div>
          <div>
            <label className={labelCls}>Telegram (без @)</label>
            <input
              type="text"
              value={form.telegram_username}
              onChange={(e) => setForm((f) => ({ ...f, telegram_username: e.target.value }))}
              className={`${inputCls} mt-1`}
              placeholder="username"
            />
          </div>
          <div>
            <label className={labelCls}>Ссылка MAX</label>
            <input
              type="url"
              value={form.max_link}
              onChange={(e) => setForm((f) => ({ ...f, max_link: e.target.value }))}
              className={`${inputCls} mt-1`}
              placeholder="https://max.ru/u/..."
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
