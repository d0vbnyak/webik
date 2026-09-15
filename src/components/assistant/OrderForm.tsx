import { forwardRef, useEffect, useState, type FormEvent } from "react";

import { ORDER_LIMITS, validateOrder } from "../../../shared/order";
import { TELEGRAM_HANDLE, TELEGRAM_URL } from "../../../shared/contacts";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; text: string };

type Props = {
  /** Задача, с которой посетитель пришёл (поле в герое) */
  initialTask?: string;
  /** Почему показана форма, а не чат */
  note?: string;
};

const field =
  "w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2.5 text-base sm:text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-black/30 transition-colors";

/** Форма заявки: уходит в Telegram через POST /api/order. Запасной путь, когда чат выключен. */
const OrderForm = forwardRef<HTMLInputElement, Props>(function OrderForm({ initialTask = "", note }, firstFieldRef) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [task, setTask] = useState(initialTask);
  const [website, setWebsite] = useState(""); // поле-ловушка для ботов
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Задача из героя может прийти, когда форма уже открыта
  useEffect(() => {
    if (initialTask) setTask(initialTask);
  }, [initialTask]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (status.kind === "sending") return;
    const order = validateOrder({ name, contact, task, details: "" });
    if ("error" in order) {
      setStatus({ kind: "error", text: order.error });
      return;
    }
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-WebIK": "1" },
        body: JSON.stringify({ ...order, website }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setStatus({ kind: "sent" });
        return;
      }
      setStatus({
        kind: "error",
        text: (data && typeof data.error === "string" && data.error) || `Не получилось отправить. Напишите в Telegram ${TELEGRAM_HANDLE}.`,
      });
    } catch {
      setStatus({ kind: "error", text: `Сеть недоступна. Напишите в Telegram ${TELEGRAM_HANDLE}.` });
    }
  };

  if (status.kind === "sent") {
    return (
      <div role="status" className="flex flex-1 flex-col items-center justify-center text-center px-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-green" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
        <p className="mt-4 font-display font-medium text-lg text-[#1a1a1a]">Заявка отправлена</p>
        <p className="mt-2 text-sm leading-relaxed text-[#1a1a1a]/60">
          Свяжусь с вами по контакту, который вы оставили. Если срочно — пишите в{" "}
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#1a1a1a]">
            Telegram {TELEGRAM_HANDLE}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3 pr-1">
        {note && <p className="text-sm leading-relaxed text-[#1a1a1a]/60">{note}</p>}
        <label className="block">
          <span className="mb-1.5 block text-xs text-[#1a1a1a]/55">Как к вам обращаться</span>
          <input ref={firstFieldRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={ORDER_LIMITS.name} autoComplete="name" className={field} placeholder="Имя" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-[#1a1a1a]/55">Контакт для связи *</span>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={ORDER_LIMITS.contact}
            required
            className={field}
            placeholder="Телефон, почта или @telegram"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-[#1a1a1a]/55">Задача *</span>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            maxLength={ORDER_LIMITS.task}
            required
            rows={4}
            className={`${field} resize-none`}
            placeholder="Например: бот, который отвечает клиентам и записывает на замер"
          />
        </label>
        {/* Ловушка: людям не видна и не доступна с клавиатуры */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-px w-px opacity-0"
        />
      </div>

      {status.kind === "error" && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs leading-relaxed text-red-900/80">
          {status.text}
        </p>
      )}
      <button
        type="submit"
        disabled={status.kind === "sending"}
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-[#1a1a1a] px-5 py-3 text-sm lowercase text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {status.kind === "sending" ? "отправляю…" : "отправить заявку"}
      </button>
    </form>
  );
});

export default OrderForm;
