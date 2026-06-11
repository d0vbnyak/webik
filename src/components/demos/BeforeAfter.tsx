import { useState } from "react";

/** Мини-макет «старый дизайн» */
function OldDesign() {
  return (
    <div className="absolute inset-0 bg-[#d9d2c5] p-4 font-serif">
      <div className="text-[13px] font-bold text-[#5a4632] underline">
        ООО «Ваш Сайт» — главная страница!!!
      </div>
      <div className="mt-2 h-px bg-[#5a4632]/40" />
      <div className="mt-2 space-y-1">
        <div className="h-2 w-4/5 bg-[#5a4632]/30" />
        <div className="h-2 w-3/5 bg-[#5a4632]/30" />
        <div className="h-2 w-2/3 bg-[#5a4632]/30" />
      </div>
      <div className="mt-3 inline-block border-2 border-[#5a4632] bg-[#e8e0d0] px-3 py-1 text-[10px] font-bold text-[#5a4632]">
        ЖМИ СЮДА
      </div>
    </div>
  );
}

/** Мини-макет «новый дизайн» */
function NewDesign() {
  return (
    <div className="absolute inset-0 bg-bg-base p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#1a1a1a]" />
          <span className="font-display text-[11px] font-medium text-[#1a1a1a]">webik</span>
        </div>
        <span className="rounded-full bg-[#1a1a1a] px-2.5 py-1 text-[8px] text-white">начать →</span>
      </div>
      <div className="mt-4 font-display text-sm font-medium leading-tight text-[#1a1a1a]">
        Сайты, которые <span className="text-[#8e8e8e]">продают.</span>
      </div>
      <div className="mt-2 h-1.5 w-3/5 rounded bg-[#1a1a1a]/10" />
      <div className="mt-1 h-1.5 w-2/5 rounded bg-[#1a1a1a]/10" />
      <div className="mt-3 flex gap-1.5">
        <span className="h-5 w-14 rounded-full bg-brand-green" />
        <span className="h-5 w-5 rounded-full border border-[#1a1a1a]/20" />
      </div>
    </div>
  );
}

export default function BeforeAfter() {
  const [pos, setPos] = useState(50);

  return (
    <div className="relative h-[240px] rounded-xl overflow-hidden border border-black/[0.05] select-none">
      <OldDesign />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <NewDesign />
      </div>

      {/* Линия-ручка */}
      <div
        className="absolute top-0 bottom-0 w-[2px] bg-[#1a1a1a] pointer-events-none"
        style={{ left: `${pos}%` }}
      >
        <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-[10px] shadow-lg">
          ⇄
        </span>
      </div>

      <span className="absolute bottom-2 left-3 text-[9px] uppercase tracking-widest text-[#5a4632]/70 pointer-events-none">
        до
      </span>
      <span className="absolute bottom-2 right-3 text-[9px] uppercase tracking-widest text-[#1a1a1a]/50 pointer-events-none">
        после
      </span>

      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Сравнить дизайн до и после"
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
      />
    </div>
  );
}
