// Общие классы оформления контролов админки (тёмная тема). DRY для форм/кнопок.

export const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none transition focus:border-brand-green placeholder:text-zinc-600";

export const labelCls = "block text-sm text-zinc-300";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-green px-4 py-2 font-medium text-black transition hover:brightness-95 disabled:opacity-60";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100";

export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-red-900/60 px-3 py-2 text-sm text-red-400 transition hover:border-red-700 hover:text-red-300";

export const chip =
  "inline-flex items-center rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs text-zinc-300";
