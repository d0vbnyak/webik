// Этапы проекта редизайна — те же, что `stage` в .webik/state.json плагина webik,
// плюс «прод»: на прод выкладывают вручную после оплаты, плагин его не сообщает.
// Общие для админки и для приёма обновлений от плагина (server/api/webik.ts).

export const PROJECT_STAGES = [
  { id: "audited", label: "Аудит", short: "Аудит" },
  { id: "designing", label: "Макет", short: "Макет" },
  { id: "built", label: "Сборка", short: "Сборка" },
  { id: "demo", label: "Демо", short: "Демо" },
  { id: "prod", label: "Прод", short: "Прод" },
] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number]["id"];

/** Этапы, которые может сообщить плагин. */
export const PLUGIN_STAGES: readonly ProjectStage[] = ["audited", "designing", "built", "demo"];

export function isProjectStage(v: unknown): v is ProjectStage {
  return PROJECT_STAGES.some((s) => s.id === v);
}

export function projectStageLabel(stage: ProjectStage): string {
  return PROJECT_STAGES.find((s) => s.id === stage)?.label ?? stage;
}

export function projectStageIndex(stage: ProjectStage): number {
  return PROJECT_STAGES.findIndex((s) => s.id === stage);
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const URL_MAX = 500;

/** Обновление проекта от плагина — поля state.json, которые админка принимает. */
export type PluginUpdate = {
  slug: string;
  stage: ProjectStage;
  name: string | null;
  source_url: string | null;
  design_artifact_url: string | null;
  demo_url: string | null;
};

/** Ссылка: только http(s), без пробелов, разумной длины. Пусто — null. */
export function cleanUrl(v: unknown): string | null | undefined {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || v.length > URL_MAX) return undefined;
  try {
    const u = new URL(v.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Проверка тела запроса от плагина. Лишние поля state.json (updated и др.)
 * игнорируются. Возвращает обновление или текст ошибки.
 */
export function parsePluginUpdate(body: unknown): PluginUpdate | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Ожидается JSON-объект state.json" };
  const b = body as Record<string, unknown>;
  if (typeof b.slug !== "string" || !SLUG_RE.test(b.slug)) return { error: "slug: только a-z, 0-9 и дефис" };
  if (!PLUGIN_STAGES.includes(b.stage as ProjectStage)) {
    return { error: `stage: одно из ${PLUGIN_STAGES.join(", ")}` };
  }
  let name: string | null = null;
  if (b.name !== undefined && b.name !== null) {
    if (typeof b.name !== "string" || b.name.trim().length === 0 || b.name.length > 200) return { error: "name: строка до 200 символов" };
    name = b.name.trim();
  }
  const urls = {} as Pick<PluginUpdate, "source_url" | "design_artifact_url" | "demo_url">;
  for (const key of ["source_url", "design_artifact_url", "demo_url"] as const) {
    const url = cleanUrl(b[key]);
    if (url === undefined) return { error: `${key}: нужна ссылка http(s)` };
    urls[key] = url;
  }
  return { slug: b.slug, stage: b.stage as ProjectStage, name, ...urls };
}

/** Имя проекта по умолчанию — домен старого сайта или slug. */
export function defaultProjectName(update: Pick<PluginUpdate, "slug" | "source_url">): string {
  if (update.source_url) {
    try {
      return new URL(update.source_url).hostname.replace(/^www\./, "");
    } catch {
      // не ссылка — ниже slug
    }
  }
  return update.slug;
}

/**
 * Этап после обновления от плагина. Проект на проде плагин назад не откатывает:
 * повторная выкладка демо после релиза — не возврат проекта в работу.
 */
export function stageAfterSync(current: ProjectStage | null, incoming: ProjectStage): ProjectStage {
  return current === "prod" ? "prod" : incoming;
}
