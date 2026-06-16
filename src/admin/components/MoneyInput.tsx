import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { inputCls } from "./controls";

type MoneyInputProps = {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  id?: string;
};

/**
 * Денежный ввод: принимает/отдаёт number, внутри хранит строку, чтобы
 * корректно набирать дробную часть. Не допускает отрицательных и мусора.
 */
export default function MoneyInput({ value, onChange, placeholder, id }: MoneyInputProps) {
  const [text, setText] = useState(value ? String(value) : "");

  // Синхронизация с внешним value только при реальном расхождении
  // (сброс/открытие формы), чтобы не затирать набор «1.» → «1».
  useEffect(() => {
    const cur = parseFloat(text.replace(",", "."));
    const curNum = Number.isFinite(cur) ? cur : 0;
    if (curNum !== value) setText(value ? String(value) : "");
    // намеренно зависим только от value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handle(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
    setText(raw);
    const n = parseFloat(raw);
    onChange(Number.isFinite(n) && n >= 0 ? n : 0);
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={handle}
      placeholder={placeholder ?? "0"}
      className={inputCls}
    />
  );
}
