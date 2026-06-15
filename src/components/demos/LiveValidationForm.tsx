import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type FieldKey = "name" | "email" | "phone";
type Status = "neutral" | "ok" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Маска российского номера: код +7 подставляется сам.
 * Ввели «9…» → сразу «+7 9…», дальше идёт пользовательский ввод.
 */
function formatPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d[0] === "8") d = "7" + d.slice(1); // 8 → 7
  if (d[0] !== "7") d = "7" + d; // напр. начали с 9 → подставляем код страны
  d = d.slice(0, 11); // 7 + 10 цифр номера
  const a = d.slice(1, 4);
  const b = d.slice(4, 7);
  const c = d.slice(7, 9);
  const e = d.slice(9, 11);
  let out = "+7";
  if (a) out += " " + a;
  if (b) out += " " + b;
  if (c) out += "-" + c;
  if (e) out += "-" + e;
  return out;
}

function validate(key: FieldKey, value: string): { status: Status; hint: string } {
  const v = value.trim();
  if (v === "") return { status: "neutral", hint: "" };
  if (key === "name") {
    return v.length >= 2
      ? { status: "ok", hint: "" }
      : { status: "error", hint: "слишком коротко" };
  }
  if (key === "email") {
    return EMAIL_RE.test(v)
      ? { status: "ok", hint: "" }
      : { status: "error", hint: "проверьте формат: name@mail.ru" };
  }
  // phone: полный номер +7 — это 11 цифр
  const digits = v.replace(/\D/g, "");
  return digits.length >= 11
    ? { status: "ok", hint: "" }
    : { status: "error", hint: "введите номер полностью" };
}

const FIELDS: { key: FieldKey; label: string; type: string; placeholder: string }[] = [
  { key: "name", label: "имя", type: "text", placeholder: "как к вам обращаться" },
  { key: "email", label: "email", type: "email", placeholder: "name@mail.ru" },
  { key: "phone", label: "телефон", type: "tel", placeholder: "+7 900 000-00-00" },
];

const RING: Record<Status, string> = {
  neutral: "border-black/[0.1] focus:border-[#1a1a1a]/40",
  ok: "border-[#16a34a]/60 focus:border-[#16a34a]",
  error: "border-[#ef4444]/60 focus:border-[#ef4444]",
};

/**
 * Форма с живой валидацией: поля подсвечиваются по мере ввода.
 * Эмуляция: «отправка» переключает экран на «заявка отправлена», без сети.
 */
export default function LiveValidationForm() {
  const uid = useId();
  const [values, setValues] = useState<Record<FieldKey, string>>({
    name: "",
    email: "",
    phone: "",
  });
  const [sent, setSent] = useState(false);

  const results = FIELDS.map((f) => ({ ...f, ...validate(f.key, values[f.key]) }));
  const allValid = results.every((r) => r.status === "ok");

  const onChange = (key: FieldKey, value: string) =>
    setValues((v) => ({ ...v, [key]: key === "phone" ? formatPhone(value) : value }));

  if (sent) {
    return (
      <div className="w-full max-w-[420px] mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-xl border border-black/[0.05] shadow-sm p-6 text-center"
        >
          <span className="mx-auto grid place-items-center w-10 h-10 rounded-full bg-brand-green text-[#1a1a1a] text-lg">
            ✓
          </span>
          <p className="mt-3 font-display font-medium text-[#1a1a1a]">
            заявка отправлена
          </p>
          <p className="mt-1 text-xs text-[#1a1a1a]/50">
            свяжемся с вами в течение дня
          </p>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setValues({ name: "", email: "", phone: "" });
            }}
            className="mt-4 text-[11px] lowercase text-[#1a1a1a]/50 hover:text-[#1a1a1a] transition-colors"
          >
            ← отправить ещё
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <form
      className="w-full max-w-[420px] mx-auto space-y-2 sm:space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (allValid) setSent(true);
      }}
      noValidate
    >
      {results.map((r) => {
        const fieldId = `${uid}-${r.key}`;
        const hintId = `${uid}-${r.key}-hint`;
        const isError = r.status === "error";
        return (
          <div key={r.key}>
            <label
              htmlFor={fieldId}
              className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40"
            >
              {r.label}
            </label>
            <div className="relative">
              <input
                id={fieldId}
                name={r.key}
                type={r.type}
                inputMode={r.key === "phone" ? "tel" : undefined}
                value={values[r.key]}
                placeholder={r.placeholder}
                aria-invalid={isError}
                aria-describedby={isError ? hintId : undefined}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onChange(r.key, e.target.value)
                }
                className={`mt-1 w-full rounded-xl border bg-white px-3.5 py-2 sm:py-2.5 pr-9 text-sm text-[#1a1a1a] placeholder:text-[#1a1a1a]/30 outline-none transition-colors ${RING[r.status]}`}
              />
              <AnimatePresence>
                {r.status !== "neutral" && (
                  <motion.span
                    key={r.status}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.15 }}
                    aria-hidden="true"
                    className={`absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-sm ${
                      r.status === "ok" ? "text-[#16a34a]" : "text-[#ef4444]"
                    }`}
                  >
                    {r.status === "ok" ? "✓" : "!"}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {isError && (
                <motion.p
                  id={hintId}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="mt-1 text-[11px] text-[#ef4444]"
                >
                  {r.hint}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      <button
        type="submit"
        disabled={!allValid}
        className="w-full rounded-full bg-[#1a1a1a] py-2 sm:py-2.5 text-sm text-white transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
      >
        отправить
      </button>
    </form>
  );
}
