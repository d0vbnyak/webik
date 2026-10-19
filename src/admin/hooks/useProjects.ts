import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../lib/db";
import { todayISO } from "../lib/dates";
import { projectStageLabel } from "../lib/projects";
import type { Income, NewProject, Project, ProjectEvent, ProjectEventType, ProjectStage } from "../lib/types";
import type { WriteResult } from "./useLeads";

type ProjectPatch = Partial<Omit<Project, "id" | "user_id" | "created_at" | "synced_at">>;

/** Новый проект и запись о нём в журнал. Без загрузки списка — для экранов, где он не нужен. */
export async function createProject(payload: NewProject): Promise<{ project: Project | null; error: string | null }> {
  const { data, error: insErr } = await db.from("projects").insert(payload).select().single();
  if (insErr) {
    return { project: null, error: insErr.code === "23505" ? `Проект со slug «${payload.slug}» уже есть` : insErr.message };
  }
  const created = data as Project;
  await db.from("project_events").insert({
    project_id: created.id,
    type: "stage",
    date: todayISO(),
    comment: `Проект заведён вручную на этапе «${projectStageLabel(created.stage)}»`,
  });
  return { project: created, error: null };
}

/** Все проекты. Ближайший шаг выше, без шага — в конце. */
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: selErr } = await db
      .from("projects")
      .select("*")
      .order("next_step_date", { ascending: true, nullsFirst: false })
      .order("name");
    if (selErr) setError(selErr.message);
    else setProjects((data ?? []) as Project[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(async (payload: NewProject): Promise<{ id: string | null; error: string | null }> => {
    const { project, error: addErr } = await createProject(payload);
    if (!project) return { id: null, error: addErr };
    setProjects((prev) => [...prev, project]);
    return { id: project.id, error: null };
  }, []);

  return { projects, loading, error, add, reload: load };
}

/** Карточка проекта: сам проект, журнал и привязанные доходы. */
export function useProject(id: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ответ для прошлого id не должен перезаписать открытую карточку
  const currentId = useRef(id);
  currentId.current = id;

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [pRes, eRes, iRes] = await Promise.all([
      db.from("projects").select("*").eq("id", id).maybeSingle(),
      db
        .from("project_events")
        .select("*")
        .eq("project_id", id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      db.from("incomes").select("*").eq("project_id", id).order("date", { ascending: false }),
    ]);
    if (currentId.current !== id) return;
    const err = pRes.error ?? eRes.error ?? iRes.error;
    if (err) setError(err.message);
    else {
      setProject(pRes.data as Project | null);
      setEvents((eRes.data ?? []) as ProjectEvent[]);
      setIncomes((iRes.data ?? []) as Income[]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (patch: ProjectPatch): Promise<WriteResult> => {
      if (!id) return { error: "Нет проекта" };
      const { data, error: updErr } = await db.from("projects").update(patch).eq("id", id).select().single();
      if (updErr) return { error: updErr.code === "23505" ? "Такой slug уже занят другим проектом" : updErr.message };
      setProject(data as Project);
      return { error: null };
    },
    [id],
  );

  const addEvent = useCallback(
    async (ev: { type: ProjectEventType; date: string; comment: string | null }): Promise<WriteResult> => {
      if (!id) return { error: "Нет проекта" };
      const { data, error: insErr } = await db
        .from("project_events")
        .insert({ ...ev, project_id: id })
        .select()
        .single();
      if (insErr) return { error: insErr.message };
      setEvents((prev) =>
        [data as ProjectEvent, ...prev].sort(
          (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
        ),
      );
      return { error: null };
    },
    [id],
  );

  /**
   * Смена этапа вручную: этап, следующий шаг и запись в журнал. Этап сменился,
   * а журнал не записался — partial, повторять смену не нужно.
   */
  const changeStage = useCallback(
    async (to: ProjectStage, step: { next_step: string | null; next_step_date: string | null }, comment: string): Promise<WriteResult> => {
      if (!project) return { error: "Нет проекта" };
      const from = project.stage;
      const res = await update({
        ...step,
        stage: to,
        ...(from !== to ? { stage_changed_at: new Date().toISOString() } : {}),
      });
      if (res.error) return res;
      if (from === to && !comment) return { error: null };
      const text = [from !== to ? `${projectStageLabel(from)} → ${projectStageLabel(to)}` : null, comment || null]
        .filter(Boolean)
        .join(" · ");
      const hist = await addEvent({ type: "stage", date: todayISO(), comment: text });
      if (hist.error) return { error: `Этап сменён, но запись в журнал не сохранилась: ${hist.error}`, partial: true };
      return { error: null };
    },
    [project, update, addEvent],
  );

  const removeEvent = useCallback(async (eventId: string): Promise<WriteResult> => {
    const { error: delErr } = await db.from("project_events").delete().eq("id", eventId);
    if (delErr) return { error: delErr.message };
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    return { error: null };
  }, []);

  const remove = useCallback(async (): Promise<WriteResult> => {
    if (!id) return { error: "Нет проекта" };
    const { error: delErr } = await db.from("projects").delete().eq("id", id);
    return { error: delErr?.message ?? null };
  }, [id]);

  return { project, events, incomes, loading, error, update, addEvent, changeStage, removeEvent, remove, reload: load };
}
