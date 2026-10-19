// Кандидаты на редизайн: статусы, разбор файла импорта, отсев дублей.
// Чистые функции, покрыты candidates.test.ts.

import { domainOf, normalizeUrl } from "./projects";
import type { Candidate, CandidateStatus, NewCandidate } from "./types";

export const CANDIDATE_STATUSES: { id: CandidateStatus; label: string }[] = [
  { id: "new", label: "Не писали" },
  { id: "contacted", label: "Написали" },
  { id: "declined", label: "Отказ" },
  { id: "converted", label: "В проекте" },
];

export function candidateStatusLabel(status: CandidateStatus): string {
  return CANDIDATE_STATUSES.find((s) => s.id === status)?.label ?? status;
}

/** Проблемы сайта по пунктам: в базе — строки через перевод строки. */
export function problemList(problems: string | null): string[] {
  return (problems ?? "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
}

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

export type ParsedImport = { items: NewCandidate[]; errors: string[] };

/**
 * Файл импорта — JSON-массив объектов:
 * { name, site_url, city?, niche?, phone?, email?, problems?: string[] | string, score? }.
 * Строка без названия или с негодной ссылкой пропускается с объяснением;
 * повтор одного домена внутри файла — тоже.
 */
export function parseCandidatesJson(text: string): ParsedImport {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return { items: [], errors: ["Файл не похож на JSON"] };
  }
  if (!Array.isArray(raw)) return { items: [], errors: ["Ожидается JSON-массив кандидатов"] };
  if (raw.length > 500) return { items: [], errors: ["Не больше 500 кандидатов за раз"] };

  const items: NewCandidate[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  raw.forEach((r, i) => {
    const row = `Строка ${i + 1}`;
    if (!r || typeof r !== "object" || Array.isArray(r)) return void errors.push(`${row}: не объект`);
    const o = r as Record<string, unknown>;
    const name = str(o.name, 200);
    if (!name) return void errors.push(`${row}: нет названия`);
    const url = normalizeUrl(typeof o.site_url === "string" ? o.site_url : "");
    if (!url.url) return void errors.push(`${row} (${name}): ${url.error ?? "нет ссылки на сайт"}`);
    const domain = (domainOf(url.url) ?? "").toLowerCase();
    if (!/^[a-z0-9.-]+$/.test(domain)) return void errors.push(`${row} (${name}): домен ${domain} — только латиница`);
    if (seen.has(domain)) return void errors.push(`${row} (${name}): ${domain} уже есть выше в файле`);
    seen.add(domain);
    const problems = Array.isArray(o.problems)
      ? o.problems.filter((p): p is string => typeof p === "string").map((p) => p.trim()).filter(Boolean).join("\n")
      : str(o.problems, 2000);
    const score = typeof o.score === "number" && Number.isFinite(o.score) ? Math.max(0, Math.min(100, Math.round(o.score))) : null;
    items.push({
      name,
      site_url: url.url,
      domain,
      city: str(o.city, 100),
      niche: str(o.niche, 100),
      phone: str(o.phone, 50),
      email: str(o.email, 200),
      problems: problems ? problems.slice(0, 2000) : null,
      score,
      status: "new",
      contacted_at: null,
      note: str(o.note, 2000),
      project_id: null,
    });
  });
  return { items, errors };
}

/** Кандидаты, которых ещё нет в базе (по домену). */
export function freshCandidates<T extends Pick<Candidate, "domain">>(items: T[], existing: Pick<Candidate, "domain">[]): { fresh: T[]; skipped: T[] } {
  const have = new Set(existing.map((c) => c.domain));
  return { fresh: items.filter((c) => !have.has(c.domain)), skipped: items.filter((c) => have.has(c.domain)) };
}

/** Порядок в списке: сначала не писали, внутри — по худшему сайту. */
export function sortCandidates<T extends Pick<Candidate, "status" | "score" | "name">>(list: T[]): T[] {
  const order: Record<CandidateStatus, number> = { new: 0, contacted: 1, converted: 2, declined: 3 };
  return [...list].sort(
    (a, b) => order[a.status] - order[b.status] || (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name),
  );
}
