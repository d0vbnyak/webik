import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

import ChatThread from "./ChatThread";
import OrderForm from "./OrderForm";
import { onOpenAssistant } from "./events";
import { useChat } from "./useChat";
import { CONTACT_EMAIL, TELEGRAM_HANDLE, TELEGRAM_URL, mailto } from "../../../shared/contacts";

const PANEL_ID = "assistant-panel";
const GREETING =
  "Здравствуйте! Я ИИ-ассистент WebIK. Расскажу об услугах и ценах, а если хотите заказать — оформлю заявку 👋";
const FORM_NOTE = "ИИ-ассистент сейчас отдыхает. Оставьте заявку — отвечу сам.";

/** contacts — ни чат, ни приём заявок не работают: показываем, куда написать напрямую */
type Mode = "unknown" | "chat" | "form" | "contacts";

/**
 * Плавающий ИИ-ассистент справа внизу на всех страницах сайта.
 *
 * Если чат на сервере включён (GET /api/chat → enabled) — диалог с ботом, заявки
 * он оформляет сам. Если выключен (в проде, пока нет российской модели) — форма
 * заявки. Оба пути пишут заявку в CRM админки.
 */
export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("unknown");
  const [prefill, setPrefill] = useState("");
  const chat = useChat(GREETING, { onUnavailable: () => setMode("form") });

  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Задача из героя, пришедшая, пока бот ещё печатает прошлый ответ */
  const pendingText = useRef<string | null>(null);
  const status = useRef<Promise<Mode> | null>(null);

  /** Спрашивает сервер один раз, включён ли чат. */
  const resolveMode = useCallback((): Promise<Mode> => {
    status.current ??= fetch("/api/chat", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d): Mode => (d?.enabled === true ? "chat" : d?.orders === true ? "form" : "contacts"))
      .catch((): Mode => "form")
      .then((m) => {
        setMode((current) => (current === "unknown" ? m : current));
        return m;
      });
    return status.current;
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setPrefill("");
    // После отрисовки: на телефоне кнопка скрыта, пока панель открыта
    requestAnimationFrame(() => launcherRef.current?.focus({ preventScroll: true }));
  }, []);

  // Открытие из других мест сайта: кнопки «начать проект», поле задачи в герое
  const { send } = chat;
  useEffect(
    () =>
      onOpenAssistant(({ text }) => {
        setOpen(true);
        void resolveMode().then((m) => {
          if (!text) return;
          if (m === "chat") {
            void send(text).then((accepted) => {
              if (!accepted) pendingText.current = text;
            });
          } else setPrefill(text);
        });
      }),
    [resolveMode, send],
  );

  // Бот договорил — отправляем отложенную задачу
  const { typing } = chat;
  useEffect(() => {
    if (typing || !pendingText.current) return;
    const text = pendingText.current;
    pendingText.current = null;
    void send(text);
  }, [typing, send]);

  useEffect(() => {
    if (!open) return;
    void resolveMode();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, resolveMode, close]);

  // Фокус в поле ввода, когда панель открылась и понятно, что в ней. На телефоне —
  // на саму панель: фокус в поле вызвал бы клавиатуру на пол-экрана без спроса
  useEffect(() => {
    if (!open || mode === "unknown") return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const id = window.setTimeout(
      () => (coarse ? panelRef.current : inputRef.current)?.focus({ preventScroll: true }),
      50,
    );
    return () => window.clearTimeout(id);
  }, [open, mode]);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id={PANEL_ID}
            tabIndex={-1}
            role="dialog"
            aria-label="ИИ-ассистент WebIK"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ transformOrigin: "bottom right" }}
            className="fixed z-[60] inset-x-3 bottom-3 h-[min(36rem,calc(100dvh-1.5rem))] sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-[380px] sm:h-[min(560px,calc(100dvh-8rem))] flex flex-col overflow-hidden rounded-2xl outline-none border border-black/[0.06] bg-bg-base shadow-[0_24px_60px_-20px_rgba(20,20,20,0.35)]"
          >
            <div className="flex items-center gap-3 border-b border-black/[0.06] bg-white px-4 py-3">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a]" aria-hidden="true">
                <SparkIcon className="h-4 w-4 text-brand-green" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display font-medium text-[15px] leading-tight text-[#1a1a1a]">ИИ-ассистент</div>
                <div className="mt-0.5 text-xs text-[#1a1a1a]/50 truncate">
                  {mode === "chat" || mode === "unknown" ? "отвечает сразу, оформит заявку" : mode === "form" ? "оставьте заявку — отвечу сам" : "напишите напрямую — отвечу сам"}
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Закрыть ассистента"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#1a1a1a]/60 hover:bg-black/[0.05] hover:text-[#1a1a1a] transition-colors"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 min-h-0 flex-col p-4">
              {mode === "unknown" && (
                <div className="flex flex-1 items-center justify-center text-sm text-[#1a1a1a]/40">загрузка…</div>
              )}
              {mode === "chat" && (
                <ChatThread ref={inputRef} messages={chat.messages} typing={chat.typing} onSend={chat.send} size="md" className="flex-1" />
              )}
              {mode === "form" && <OrderForm ref={inputRef} initialTask={prefill} note={FORM_NOTE} />}
              {mode === "contacts" && <DirectContacts task={prefill} />}
            </div>

            {mode !== "contacts" && (
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 border-t border-black/[0.06] bg-white px-4 py-2.5 text-xs text-[#1a1a1a]/60 hover:text-[#1a1a1a] transition-colors"
              >
                <TelegramIcon className="h-3.5 w-3.5" />
                или напишите в Telegram {TELEGRAM_HANDLE}
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        ref={launcherRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? "Закрыть ИИ-ассистента" : "Открыть ИИ-ассистента"}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        // z-40: ниже шапки с мобильным меню, панель ассистента — выше неё
        className={`fixed z-40 right-4 bottom-4 sm:right-6 sm:bottom-6 h-14 w-14 items-center justify-center rounded-full bg-[#1a1a1a] text-white shadow-[0_12px_32px_-10px_rgba(20,20,20,0.55)] transition-transform hover:scale-105 active:scale-95 ${
          // На телефоне панель закрывает кнопку — прячем её, закрыть можно крестиком в шапке
          open ? "hidden sm:flex" : "flex"
        }`}
      >
        {open ? (
          <CloseIcon className="h-5 w-5" />
        ) : (
          <>
            <ChatIcon className="h-6 w-6" />
            <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-brand-green ring-2 ring-[#1a1a1a]" aria-hidden="true" />
          </>
        )}
      </button>
    </MotionConfig>
  );
}

/** Куда написать напрямую, когда заявки с сайта не принимаются. Задачу из героя можно скопировать */
function DirectContacts({ task }: { task: string }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-3">
      <p className="text-sm leading-relaxed text-[#1a1a1a]/60">
        ИИ-ассистент сейчас отдыхает. Напишите мне напрямую — отвечу сам.
      </p>
      {task && (
        <p className="rounded-lg border border-black/[0.06] bg-white px-3 py-2.5 text-sm leading-relaxed text-[#1a1a1a]/80 whitespace-pre-wrap break-words">
          {task}
        </p>
      )}
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#1a1a1a] px-5 py-3 text-sm text-white hover:bg-black transition-colors"
      >
        <TelegramIcon className="h-4 w-4" />
        Telegram {TELEGRAM_HANDLE}
      </a>
      <a
        href={task ? `${mailto("Заявка с сайта WebIK")}&body=${encodeURIComponent(task)}` : mailto("Заявка с сайта WebIK")}
        className="inline-flex items-center justify-center rounded-full border border-black/[0.1] bg-white px-5 py-3 text-sm text-[#1a1a1a] hover:border-black/25 transition-colors break-all"
      >
        {CONTACT_EMAIL}
      </a>
    </div>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l.9-5.2A8 8 0 1 1 21 12Z" />
      <path d="M12 8.5v.01M12 8.5l.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9Z" />
    </svg>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.5l2.1 6.4 6.4 2.1-6.4 2.1L12 19.5l-2.1-6.4L3.5 11l6.4-2.1Z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M21.4 4.2 2.9 11.3c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.4l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.4-1.5ZM9.6 14.2l-.4 4.2-1.3-4.3 10.6-6.7-8.9 6.8Z" />
    </svg>
  );
}
