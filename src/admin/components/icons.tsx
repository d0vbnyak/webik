import type { ReactNode } from "react";

// Иконки — inline-SVG без сторонних зависимостей, stroke=currentColor.
const ic = (path: ReactNode, size = 20) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

export const IconToday = () => ic(<><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17" /><path d="M8 3v3" /><path d="M16 3v3" /><path d="M8.5 14.5l2.2 2.2 4.8-4.8" /></>);
export const IconProjects = () => ic(<><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 8h18" /><path d="M6 6h.01" /><path d="M8.5 6h.01" /><path d="M8 21h8" /><path d="M12 18v3" /></>);
export const IconMoney = () => ic(<><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6.5 9.5v.01" /><path d="M17.5 14.5v.01" /></>);
export const IconClients = () => ic(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 6.5a3 3 0 0 1 0 5.8" /><path d="M16.5 14.5A5.5 5.5 0 0 1 20.5 20" /></>);
export const IconArchive = () => ic(<><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></>);
export const IconSettings = () => ic(<><circle cx="12" cy="12" r="3" /><path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 0 1-4 0v-.2A1.7 1.7 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 0 1 0-4h.2A1.7 1.7 0 0 0 4.7 7L4.6 7a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z" /></>);
export const IconCandidates = () => ic(<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /><path d="M8.5 11h5" /><path d="M11 8.5v5" /></>);
export const IconMore = () => ic(<><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>);
export const IconExternal = () => ic(<><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>, 14);
export const IconArrow = () => ic(<><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>, 14);
export const IconPlugin = () => ic(<><path d="M9 3v4" /><path d="M15 3v4" /><path d="M6 7h12v4a6 6 0 0 1-12 0z" /><path d="M12 17v4" /></>, 14);
