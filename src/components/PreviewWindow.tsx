import type { ReactNode } from "react";

type PreviewWindowProps = {
  url: string;
  children: ReactNode;
};

/** Рамка в виде браузерного окна для живых демо */
export default function PreviewWindow({ url, children }: PreviewWindowProps) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.05] shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.05]">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 flex justify-center">
          <span className="text-[10px] tracking-wide text-[#1a1a1a]/40 bg-zinc-100 rounded-full px-3 py-1 truncate max-w-[200px]">
            webik.ru/{url}
          </span>
        </div>
        <div className="w-10" aria-hidden="true" />
      </div>
      <div className="p-4 md:p-5 bg-zinc-50/60 min-h-[260px] flex flex-col justify-center">
        {children}
      </div>
    </div>
  );
}
