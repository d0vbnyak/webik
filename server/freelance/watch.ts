/**
 * Один проход бота: собрать заказы со всех площадок, отобрать интересные,
 * прислать новые в Telegram, запомнить отправленное.
 *
 * Память — JSON-файл с ключами уже виденных заказов. Площадку, которую бот
 * читает впервые, он только запоминает, не присылая: иначе первый запуск
 * завалил бы чат сотней старых заказов.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { matchJob, type FilterOptions } from "./filter";
import type { Job, Source } from "./sources";
import { formatJob, TelegramError, type Telegram } from "./telegram";

/** Сколько ключей помнить. Площадки отдают сотню-другую заказов — запаса на месяцы. */
const SEEN_LIMIT = 20_000;

export type Seen = { sources: string[]; keys: string[] };

export async function loadSeen(path: string): Promise<Seen> {
  try {
    const data = JSON.parse(await readFile(path, "utf8")) as Partial<Seen>;
    return { sources: data.sources ?? [], keys: data.keys ?? [] };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { sources: [], keys: [] };
    throw e;
  }
}

/** Через временный файл: оборванная запись не испортит память. */
export async function saveSeen(path: string, seen: Seen): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify({ sources: seen.sources, keys: seen.keys.slice(-SEEN_LIMIT) }));
  await rename(tmp, path);
}

export type Log = (line: string) => void;

export type CheckResult = { found: number; sent: number; failedSources: string[] };

export async function checkOnce(opts: {
  sources: Source[];
  seen: Seen;
  filter: FilterOptions;
  /** null — пробный запуск: заказы печатаются в лог, память не меняется. */
  telegram: Telegram | null;
  log: Log;
  /** Пауза между сообщениями: Telegram не любит больше одного в секунду в чат. */
  pauseMs?: number;
}): Promise<CheckResult> {
  const { seen, log } = opts;
  const known = new Set(seen.keys);
  const result: CheckResult = { found: 0, sent: 0, failedSources: [] };

  const batches = await Promise.all(
    opts.sources.map(async (source) => {
      try {
        return { source, jobs: await source.fetchJobs() };
      } catch (e) {
        log(`${source.name}: ${(e as Error).message}`);
        result.failedSources.push(source.name);
        return { source, jobs: [] as Job[] };
      }
    }),
  );

  for (const { source, jobs } of batches) {
    if (result.failedSources.includes(source.name)) continue;
    // Один заказ бывает в двух разделах — убираем повторы
    const fresh = [...new Map(jobs.filter((j) => !known.has(j.key)).map((j) => [j.key, j])).values()];
    result.found += jobs.length;

    // Пробный запуск показывает всё подходящее, в том числе с новых площадок
    if (opts.telegram && !seen.sources.includes(source.name)) {
      seen.keys.push(...fresh.map((j) => j.key));
      seen.sources.push(source.name);
      log(`${source.name}: первый запуск, запомнил ${fresh.length} заказов без отправки`);
      continue;
    }

    for (const job of fresh) {
      const match = matchJob(job, opts.filter);
      if (!match) {
        if (opts.telegram) seen.keys.push(job.key);
        continue;
      }
      if (!opts.telegram) {
        log(`[${match.topics.join(", ")}] ${job.source} · ${job.budget ?? "—"} · ${job.title}\n  ${job.url}`);
        result.sent++;
        continue;
      }
      try {
        await opts.telegram.send(formatJob(job, match.topics));
        result.sent++;
        seen.keys.push(job.key);
        await new Promise((r) => setTimeout(r, opts.pauseMs ?? 1100));
      } catch (e) {
        log(`Telegram: ${(e as Error).message} — ${job.url}`);
        // Сообщение не приняли — повтор не поможет, пропускаем заказ.
        // Сеть или Telegram недоступны — остальное отправим в следующий проход.
        if (e instanceof TelegramError && e.permanent) seen.keys.push(job.key);
        else return result;
      }
    }
  }
  return result;
}
