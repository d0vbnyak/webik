import { PROJECT_STAGES, stageReached } from "../lib/projects";
import type { ProjectStage } from "../lib/types";

/**
 * Шкала этапов webik — подпись интерфейса. Пройденные этапы — бумажные,
 * текущий — фирменный салатовый, впереди — едва заметные. У закрытого
 * проекта шкала гаснет целиком.
 */
export default function StageRail({
  stage,
  closed = false,
  labels = false,
  onPick,
}: {
  stage: ProjectStage;
  closed?: boolean;
  /** Подписи этапов под шкалой. */
  labels?: boolean;
  /** Этапы становятся кнопками — смена этапа в карточке проекта. */
  onPick?: (stage: ProjectStage) => void;
}) {
  const seg = (s: ProjectStage) => {
    const r = stageReached(stage, s);
    if (closed) return r === "ahead" ? "bg-zinc-800" : "bg-zinc-600";
    return r === "done" ? "bg-zinc-300" : r === "current" ? "bg-brand-green" : "bg-zinc-800";
  };
  const text = (s: ProjectStage) => {
    const r = stageReached(stage, s);
    if (r === "current" && !closed) return "text-zinc-100 font-medium";
    return r === "done" ? "text-zinc-400" : "text-zinc-600";
  };

  if (!labels) {
    return (
      <div className="flex gap-[3px]" role="img" aria-label={`Этап: ${PROJECT_STAGES.find((s) => s.id === stage)?.label}`}>
        {PROJECT_STAGES.map((s) => (
          <span key={s.id} className={`h-[3px] flex-1 rounded-full ${seg(s.id)}`} />
        ))}
      </div>
    );
  }

  return (
    <ol className="grid grid-cols-5 gap-1">
      {PROJECT_STAGES.map((s) => {
        const body = (
          <>
            <span className={`block h-1 rounded-full transition-colors ${seg(s.id)}`} />
            <span className={`mt-2 block text-left text-xs ${text(s.id)}`}>{s.label}</span>
          </>
        );
        return (
          <li key={s.id}>
            {onPick ? (
              <button
                type="button"
                onClick={() => onPick(s.id)}
                aria-current={s.id === stage ? "step" : undefined}
                className="group -m-1 block w-[calc(100%+0.5rem)] rounded-lg p-1 pb-2 text-left transition-colors hover:bg-zinc-900"
              >
                {body}
              </button>
            ) : (
              <div aria-current={s.id === stage ? "step" : undefined}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
