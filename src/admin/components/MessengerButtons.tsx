import { messengerLinks } from "../lib/phone";
import type { Client } from "../lib/types";

type Props = Pick<Client, "phone" | "telegram_username" | "max_link">;

const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 text-zinc-200 transition hover:border-zinc-500";

export default function MessengerButtons({ phone, telegram_username, max_link }: Props) {
  const links = messengerLinks({ phone, telegram_username, max_link });

  return (
    <div className="flex items-center gap-2">
      {links.whatsapp && (
        <a
          href={links.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          title="WhatsApp"
          className={`${iconBtn} hover:text-green-400`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.3 0 .5l-.4.6c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.7-.9c.2-.2.3-.2.6-.1l1.9.9c.3.1.4.2.5.3 0 .2 0 .8-.2 1.3Z" />
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
      {!links.whatsapp && !links.telegram && !links.max && (
        <span className="text-xs text-zinc-600">нет контактов</span>
      )}
    </div>
  );
}
