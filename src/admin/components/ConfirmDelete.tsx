import { useState } from "react";

type ConfirmDeleteProps = {
  onConfirm: () => void;
  /** Текст кнопки по умолчанию (иначе иконка-корзина). */
  label?: string;
};

/** Двухшаговое удаление: первый клик показывает «Удалить?», второй — выполняет. */
export default function ConfirmDelete({ onConfirm, label }: ConfirmDeleteProps) {
  const [armed, setArmed] = useState(false);

  if (armed) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-red-500/90 px-2 py-1 font-medium text-white transition hover:bg-red-500"
        >
          Удалить
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="rounded-md px-2 py-1 text-zinc-400 transition hover:text-zinc-200"
        >
          Отмена
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      aria-label="Удалить"
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:text-red-400"
    >
      {label ?? "Удалить"}
    </button>
  );
}
