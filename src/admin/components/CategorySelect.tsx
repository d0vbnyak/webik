import { useState } from "react";
import type { Category } from "../lib/types";
import { inputCls, btnGhost } from "./controls";

type CategorySelectProps = {
  value: string;
  onChange: (name: string) => void;
  options: Category[];
  /** Добавить новую категорию (этого же типа). Возвращает ошибку или null. */
  onAdd: (name: string) => Promise<{ error: string | null }>;
};

export default function CategorySelect({ value, onChange, options, onAdd }: CategorySelectProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirmAdd() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const { error } = await onAdd(name);
    setBusy(false);
    if (!error) {
      onChange(name);
      setNewName("");
      setAdding(false);
    }
  }

  if (adding) {
    return (
      <div className="flex gap-2">
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Новая категория"
          className={inputCls}
        />
        <button type="button" onClick={() => void confirmAdd()} disabled={busy} className={btnGhost}>
          ОК
        </button>
        <button type="button" onClick={() => setAdding(false)} className={btnGhost}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        {options.length === 0 && <option value="">—</option>}
        {options.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setAdding(true)}
        title="Добавить категорию"
        className={btnGhost}
      >
        +
      </button>
    </div>
  );
}
