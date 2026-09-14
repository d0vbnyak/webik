import { stageIndex, stageLabel } from "../lib/crm";
import type { LeadStage } from "../lib/types";

/** Цвет этапа: холодные — серые, в работе — жёлтые, сделка — зелёные, отказ — красный. */
function tone(stage: LeadStage): string {
  if (stage === "lost") return "bg-red-500/15 text-red-400";
  const idx = stageIndex(stage);
  if (idx >= stageIndex("pilot")) return "bg-brand-green/15 text-brand-green";
  if (idx >= stageIndex("replied")) return "bg-amber-400/15 text-amber-300";
  return "bg-zinc-800 text-zinc-300";
}

export default function StageChip({ stage }: { stage: LeadStage }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] ${tone(stage)}`}>
      {stageLabel(stage)}
    </span>
  );
}
