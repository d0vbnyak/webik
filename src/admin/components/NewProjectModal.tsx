import { useEffect, useState } from "react";
import Modal from "./Modal";
import { inputCls, labelCls, btnPrimary, btnGhost } from "./controls";
import { defaultProjectStep, normalizeUrl, slugError, slugFromUrl } from "../lib/projects";
import { todayISO } from "../lib/dates";
import type { NewProject } from "../lib/types";

export type ProjectDraft = {
  name?: string;
  source_url?: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  telegram_username?: string | null;
  note?: string | null;
};

/**
 * Новый проект вручную — когда плагин ещё не запускали (например, из заявки
 * с сайта). slug подставляется из домена так же, как его выберет плагин:
 * по нему плагин потом найдёт этот проект и продолжит его.
 */
export default function NewProjectModal({
  open,
  draft,
  onClose,
  onCreate,
}: {
  open: boolean;
  draft?: ProjectDraft;
  onClose: () => void;
  onCreate: (p: NewProject) => Promise<{ error: string | null }>;
}) {
  const [name, setName] = useState("");
  const [site, setSite] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(draft?.name ?? "");
    setSite(draft?.source_url ?? "");
    setSlug(slugFromUrl(draft?.source_url ?? null));
    setSlugTouched(false);
    setError(null);
  }, [open, draft]);

  function changeSite(v: string) {
    setSite(v);
    if (!slugTouched) setSlug(slugFromUrl(v));
  }

  async function save() {
    const url = normalizeUrl(site);
    if (url.error) return setError(url.error);
    if (!name.trim()) return setError("Назовите проект — обычно по компании клиента");
    const slugErr = slugError(slug);
    if (slugErr) return setError(slugErr);
    const step = defaultProjectStep("audited", todayISO());
    setSaving(true);
    const res = await onCreate({
      name: name.trim(),
      slug,
      source_url: url.url,
      stage: "audited",
      next_step: step.text,
      next_step_date: step.date,
      contact_name: draft?.contact_name ?? null,
      phone: draft?.phone ?? null,
      email: draft?.email ?? null,
      telegram_username: draft?.telegram_username ?? null,
      note: draft?.note ?? null,
    });
    setSaving(false);
    if (res.error) setError(res.error);
  }

  return (
    <Modal open={open} onClose={onClose} title="Новый проект">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="block">
          <span className={labelCls}>Старый сайт</span>
          <input
            value={site}
            onChange={(e) => changeSite(e.target.value)}
            placeholder="stroymir.ru"
            inputMode="url"
            autoFocus
            className={`${inputCls} mt-1 font-mono text-sm`}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Название</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Строймир" className={`${inputCls} mt-1`} />
        </label>
        <label className="block">
          <span className={labelCls}>slug</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            placeholder="stroymir"
            className={`${inputCls} mt-1 font-mono text-sm`}
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Имя папки проекта и поддомена демо. Плагин найдёт проект по нему.
          </span>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>
            Отмена
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? "Создаю…" : "Создать проект"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
