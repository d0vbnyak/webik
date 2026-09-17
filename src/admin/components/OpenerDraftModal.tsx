import { useEffect, useState } from "react";
import type { Lead } from "../lib/types";
import { VARIANTS } from "../lib/crm";
import { formatRub, variantFromLetter, type OpenerDraft } from "../lib/ai";
import Modal from "./Modal";
import Spinner from "./Spinner";
import { btnGhost, btnPrimary, inputCls, labelCls } from "./controls";

type Fields = { first_line: string; hook: string; variant: string; business: string };

type Props = {
  lead: Lead;
  draft: OpenerDraft | null;
  onClose: () => void;
  /** Ещё один вариант — тот же запрос заново */
  onRetry: () => void;
  retrying: boolean;
  /** Ошибка повторного запроса — черновик при этом остаётся прежним */
  retryError: string | null;
  onSave: (patch: Partial<Lead>) => Promise<{ error: string | null }>;
};

const FIT_LABEL: Record<OpenerDraft["fit"], string> = {
  да: "наша ниша",
  нет: "похоже, не наша ниша",
  неясно: "ниша неясна",
};

/**
 * Черновик первой строки от ИИ. Ничего не сохраняется без кнопки: Сергей
 * читает, правит и только потом пишет в карточку.
 */
export default function OpenerDraftModal({ lead, draft, onClose, onRetry, retrying, retryError, onSave }: Props) {
  const [fields, setFields] = useState<Fields>({ first_line: "", hook: "", variant: "", business: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Новый черновик — новые поля. «Чем заняты», уже заполненное руками, не затираем.
  // Зацепки нет — вариант от модели заглушка, не подставляем его
  useEffect(() => {
    if (!draft) return;
    const empty = !draft.first_line.trim();
    setFields({
      first_line: draft.first_line,
      hook: draft.hook || (lead.hook ?? ""),
      variant: empty ? (lead.variant ?? "") : variantFromLetter(draft.variant),
      business: lead.business?.trim() ? lead.business : draft.business,
    });
    setError(null);
  }, [draft, lead.business]);

  if (!draft) return null;

  const set = (key: keyof Fields) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  async function save() {
    if (!fields.first_line.trim()) return setError("Первая строка пустая — напишите её или закройте черновик");
    setSaving(true);
    // Пустое поле в окне не стирает то, что уже есть в карточке
    const patch: Partial<Lead> = { first_line: fields.first_line.trim() };
    if (fields.hook.trim()) patch.hook = fields.hook.trim();
    if (fields.variant) patch.variant = fields.variant;
    if (fields.business.trim()) patch.business = fields.business.trim();
    const res = await onSave(patch);
    setSaving(false);
    if (res.error) return setError(res.error);
    onClose();
  }

  // Что из заполненного в карточке перепишет сохранение
  const replaced = [
    { label: "первая строка", was: lead.first_line, now: fields.first_line },
    { label: "зацепка", was: lead.hook, now: fields.hook },
    { label: "вариант письма", was: lead.variant, now: fields.variant },
    { label: "«чем заняты»", was: lead.business, now: fields.business },
  ]
    .filter((f) => f.was?.trim() && f.now.trim() && f.was.trim() !== f.now.trim())
    .map((f) => f.label);

  return (
    <Modal open onClose={onClose} title="Черновик от ИИ">
      <div className="space-y-3">
        {draft.warnings.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            {draft.warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        )}

        <p className="text-xs text-zinc-500">
          {draft.source === "site" ? `Сайт, страниц: ${draft.pages.length}` : "Поиск Яндекса по сайту"} ·{" "}
          {FIT_LABEL[draft.fit]} · {draft.model} · {formatRub(draft.costRub)}
        </p>

        {draft.quote && (
          <figure className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
            <blockquote className="text-sm text-zinc-300">«{draft.quote}»</blockquote>
            <figcaption className={`mt-1 text-xs ${draft.quoteFound ? "text-brand-green" : "text-amber-300"}`}>
              {draft.quoteFound ? "✓ цитата есть в тексте сайта" : "цитата не найдена — проверьте факт"}
            </figcaption>
          </figure>
        )}

        <div>
          <label className={labelCls} htmlFor="ai-first-line">Первая строка письма</label>
          <textarea id="ai-first-line" value={fields.first_line} onChange={set("first_line")} rows={4} className={`${inputCls} mt-1`} />
          <p className="mt-1 text-right text-xs text-zinc-500">{fields.first_line.length} симв.</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="ai-hook">Зацепка с сайта</label>
          <textarea id="ai-hook" value={fields.hook} onChange={set("hook")} rows={2} className={`${inputCls} mt-1`} />
        </div>
        <div>
          <label className={labelCls} htmlFor="ai-variant">Вариант письма</label>
          <select id="ai-variant" value={fields.variant} onChange={set("variant")} className={`${inputCls} mt-1`}>
            <option value="">—</option>
            {VARIANTS.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="ai-business">Чем заняты</label>
          <textarea id="ai-business" value={fields.business} onChange={set("business")} rows={2} className={`${inputCls} mt-1`} />
        </div>

        {draft.pages.length > 0 && (
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer">Откуда взято</summary>
            <ul className="mt-1 space-y-0.5">
              {draft.pages.map((p) => (
                <li key={p}>
                  <a href={p} target="_blank" rel="noopener noreferrer" className="break-all text-brand-green hover:underline">{p}</a>
                </li>
              ))}
            </ul>
          </details>
        )}

        {replaced.length > 0 && (
          <p className="text-xs text-amber-300">В карточке будет заменено: {replaced.join(", ")}.</p>
        )}
        {(error ?? retryError) && <p className="text-sm text-red-400">{error ?? retryError}</p>}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" onClick={onRetry} disabled={retrying || saving} className={`${btnGhost} disabled:opacity-60`}>
            {retrying ? <Spinner /> : "Ещё вариант"}
          </button>
          <button type="button" onClick={onClose} className={btnGhost}>Отмена</button>
          <button type="button" onClick={() => void save()} disabled={saving || retrying} className={btnPrimary}>
            {saving ? <Spinner /> : "Сохранить в карточку"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
