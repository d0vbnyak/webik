import { Link } from "react-router";
import StageRail from "./StageRail";
import { domainOf, dueText, projectStageLabel } from "../lib/projects";
import type { Project } from "../lib/types";

/** Пара адресов «старый → демо» моноширинным: так проект узнаётся с одного взгляда. */
export function DomainPair({ project, className = "" }: { project: Pick<Project, "source_url" | "demo_url" | "slug">; className?: string }) {
  const from = domainOf(project.source_url);
  const to = domainOf(project.demo_url);
  return (
    <div className={`truncate font-mono text-xs text-zinc-500 ${className}`}>
      {from ?? project.slug}
      {to && (
        <>
          <span className="px-1.5 text-zinc-600">→</span>
          <span className="text-zinc-400">{to}</span>
        </>
      )}
    </div>
  );
}

/**
 * Строка проекта в списках: название и этап, адреса, шкала, следующий шаг.
 * Просроченный шаг подсвечивается кирпичным — единственный цветной акцент строки.
 */
export default function ProjectRow({ project, today, showStep = true }: { project: Project; today: string; showStep?: boolean }) {
  const due = project.next_step_date ? dueText(project.next_step_date, today) : null;
  return (
    <Link
      to={`/admin/projects/${project.id}`}
      className="group block rounded-xl border border-zinc-800/80 bg-zinc-900 px-4 py-3 transition-colors hover:border-zinc-700"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[15px] font-medium text-zinc-100">{project.name}</span>
        <span className={`shrink-0 text-xs ${project.closed ? "text-zinc-600" : "text-zinc-400"}`}>
          {project.closed ? "закрыт" : projectStageLabel(project.stage)}
        </span>
      </div>
      <DomainPair project={project} className="mt-0.5" />
      <div className="mt-3">
        <StageRail stage={project.stage} closed={project.closed} />
      </div>
      {showStep && (project.next_step || due) && (
        <div className="mt-2.5 flex items-baseline justify-between gap-3 text-[13px]">
          <span className="truncate text-zinc-300">{project.next_step || "Шаг не записан"}</span>
          {due && <span className={`shrink-0 text-xs ${due.overdue ? "text-red-400" : "text-zinc-500"}`}>{due.text}</span>}
        </div>
      )}
    </Link>
  );
}
