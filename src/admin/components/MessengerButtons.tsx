import { messengerLinks } from "../lib/phone";
import type { Client } from "../lib/types";

type Props = Pick<Client, "phone" | "telegram_username" | "max_link">;

const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 text-zinc-200 transition hover:border-zinc-500";

export default function MessengerButtons({ phone, telegram_username, max_link }: Props) {
  const links = messengerLinks({ phone, telegram_username, max_link });

  return (
    <div className="flex items-center gap-2">
      {links.call && (
        <a href={links.call} aria-label="Позвонить" title="Позвонить" className={`${iconBtn} hover:text-brand-green`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
          </svg>
        </a>
      )}
      {links.telegram && (
        <a
          href={links.telegram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Telegram"
          title="Telegram"
          className={`${iconBtn} hover:text-sky-400`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21.9 4.3 18.6 20c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6 13.4l-4.8-1.5c-1-.3-1-1 .2-1.5L20.7 3c.9-.3 1.6.2 1.2 1.3Z" />
          </svg>
        </a>
      )}
      {links.max && (
        <a
          href={links.max}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="MAX"
          title="MAX"
          className={`${iconBtn} text-xs font-bold hover:text-brand-green`}
        >
          MAX
        </a>
      )}
      {!links.call && !links.telegram && !links.max && (
        <span className="text-xs text-zinc-600">нет контактов</span>
      )}
    </div>
  );
}
