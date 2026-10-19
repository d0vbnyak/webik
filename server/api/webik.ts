/**
 * Связь с плагином webik: плагин после каждого этапа шлёт state.json проекта,
 * админка создаёт или обновляет проект по slug.
 *
 * Плагин входит не паролем, а токеном (Authorization: Bearer …). Токен
 * выпускается в настройках админки и показывается один раз; в базе — только
 * его SHA-256, как у сессий. Один токен на пользователя: новый заменяет старый.
 */
import { randomBytes } from "node:crypto";
import type { Db } from "../db/db";
import { isTokenFormat, sha256 } from "./auth";
import {
  defaultProjectName,
  projectStageLabel,
  stageAfterSync,
  type PluginUpdate,
  type ProjectStage,
} from "../../shared/projects";

export async function issueToken(db: Db, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    `insert into api_tokens (id, user_id) values ($1, $2)
     on conflict (user_id) do update set id = excluded.id, created_at = now(), last_used_at = null`,
    [sha256(token), userId],
  );
  return token;
}

export async function revokeToken(db: Db, userId: string): Promise<void> {
  await db.query("delete from api_tokens where user_id = $1", [userId]);
}

export async function tokenInfo(
  db: Db,
  userId: string,
): Promise<{ created_at: string; last_used_at: string | null } | null> {
  const [row] = await db.query<{ created_at: string; last_used_at: string | null }>(
    "select created_at, last_used_at from api_tokens where user_id = $1",
    [userId],
  );
  return row ?? null;
}

/** Пользователь по токену из заголовка Authorization; заодно отметка об использовании. */
export async function tokenUser(db: Db, header: string | undefined): Promise<string | null> {
  const token = header?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!isTokenFormat(token)) return null;
  const [row] = await db.query<{ user_id: string }>(
    "update api_tokens set last_used_at = now() where id = $1 returning user_id",
    [sha256(token)],
  );
  return row?.user_id ?? null;
}

export type SyncResult = { id: string; created: boolean; stage: ProjectStage };

/**
 * Создать или обновить проект по обновлению от плагина. Пустые ссылки не
 * стирают уже записанные: state.json на раннем этапе ещё не знает демо-адреса.
 * Название задаётся только при создании — в админке его могли поправить.
 */
export async function syncProject(db: Db, userId: string, u: PluginUpdate): Promise<SyncResult> {
  const [prev] = await db.query<{ id: string; stage: ProjectStage }>(
    "select id, stage from projects where user_id = $1 and slug = $2",
    [userId, u.slug],
  );
  const stage = stageAfterSync(prev?.stage ?? null, u.stage);
  const [row] = await db.query<{ id: string }>(
    `insert into projects (user_id, slug, name, source_url, stage, design_artifact_url, demo_url, synced_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())
     on conflict (user_id, slug) do update set
       source_url = coalesce(excluded.source_url, projects.source_url),
       design_artifact_url = coalesce(excluded.design_artifact_url, projects.design_artifact_url),
       demo_url = coalesce(excluded.demo_url, projects.demo_url),
       stage = excluded.stage,
       stage_changed_at = case when projects.stage = excluded.stage then projects.stage_changed_at else now() end,
       synced_at = now()
     returning id`,
    [userId, u.slug, u.name ?? defaultProjectName(u), u.source_url, stage, u.design_artifact_url, u.demo_url],
  );
  const comment = !prev
    ? `Плагин: проект создан на этапе «${projectStageLabel(stage)}»`
    : prev.stage !== stage
      ? `Плагин: ${projectStageLabel(prev.stage)} → ${projectStageLabel(stage)}`
      : null;
  if (comment) {
    await db.query(
      `insert into project_events (user_id, project_id, type, date, comment) values ($1, $2, 'stage', current_date, $3)`,
      [userId, row.id, comment],
    );
  }
  return { id: row.id, created: !prev, stage };
}
