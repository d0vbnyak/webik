/**
 * Один проход бота: собрать заказы со всех площадок, отобрать интересные,
 * прислать новые в Telegram, запомнить отправленное.
 *
 * Площадку, которую бот читает впервые, он только запоминает, не присылая:
 * иначе первый запуск завалил бы чат сотней старых заказов. Память и обучение
 * на «Не то» — state.ts.
 */
import { matchJob, type FilterOptions } from "./filter";
import type { Job, Source } from "./sources";
import { bump, learnedBlock, learnedRules, type State } from "./state";
import { formatJob, TelegramError, type Telegram } from "./telegram";

export type Log = (line: string) => void;

export type CheckResult = { found: number; sent: number; muted: number; failedSources: string[] };

export async function checkOnce(opts: {
  sources: Source[];
  state: State;
  filter: FilterOptions;
  /** null — пробный запуск: заказы печатаются в лог, память не меняется. */
  telegram: Telegram | null;
  log: Log;
  /** Пауза между сообщениями: Telegram не любит больше одного в секунду в чат. */
  pauseMs?: number;
  /** Сохранить память после каждого сообщения: Ctrl+C посреди рассылки не даст повторов. */
  persist?: () => Promise<void>;
}): Promise<CheckResult> {
  const { state, log } = opts;
  const live = opts.telegram !== null;
  const known = new Set(state.keys);
  const rules = learnedRules(state);
  const result: CheckResult = { found: 0, sent: 0, muted: 0, failedSources: [] };
  const now = () => new Date().toISOString();

  const batches = await Promise.all(
    opts.sources.map(async (source) => {
      try {
        const jobs = await source.fetchJobs();
        if (live) state.status[source.name] = { ok: true, at: now(), count: jobs.length };
        return { source, jobs };
      } catch (e) {
        const error = (e as Error).message;
        log(`${source.name}: ${error}`);
        result.failedSources.push(source.name);
        const prev = state.status[source.name];
        const at = now();
        if (live) state.status[source.name] = { ok: false, at, count: 0, error, failingSince: prev && !prev.ok ? (prev.failingSince ?? prev.at) : at };
        return { source, jobs: [] as Job[] };
      }
    }),
  );
  if (live) state.lastCheckAt = now();

  for (const { source, jobs } of batches) {
    if (result.failedSources.includes(source.name)) continue;
    // Один заказ бывает в двух разделах — убираем повторы
    const fresh = [...new Map(jobs.filter((j) => !known.has(j.key)).map((j) => [j.key, j])).values()];
    result.found += jobs.length;

    // Пробный запуск показывает всё подходящее, в том числе с новых площадок
    if (live && !state.sources.includes(source.name)) {
      state.keys.push(...fresh.map((j) => j.key));
      state.sources.push(source.name);
      log(`${source.name}: первый запуск, запомнил ${fresh.length} заказов без отправки`);
      continue;
    }
    if (live) bump(state, "read", fresh.length);

    for (const job of fresh) {
      const match = matchJob(job, opts.filter);
      const blocked = match && learnedBlock(job, rules);
      if (!match || blocked) {
        if (blocked) {
          result.muted++;
          log(`отсеял по «Не то» (${blocked}): ${job.title}`);
        }
        if (live) {
          state.keys.push(job.key);
          if (blocked) bump(state, "muted");
        }
        continue;
      }
      if (!opts.telegram) {
        log(`[${match.topics.join(", ")}] ${job.source} · ${job.budget ?? "—"} · ${job.title}\n  ${job.url}`);
        result.sent++;
        continue;
      }
      try {
        await opts.telegram.send(formatJob(job, match.topics), job.key);
        result.sent++;
        state.keys.push(job.key);
        state.sent.push({ key: job.key, title: job.title, source: job.source, category: job.category, at: now() });
        bump(state, "sent");
      } catch (e) {
        log(`Telegram: ${(e as Error).message} — ${job.url}`);
        // Сообщение не приняли — повтор не поможет, пропускаем заказ.
        // Сеть или Telegram недоступны — остальное отправим в следующий проход.
        if (e instanceof TelegramError && e.permanent) state.keys.push(job.key);
        else return result;
      }
      // Не удалось записать (на Windows rename бывает занят) — запишется в конце прохода
      await opts.persist?.().catch((e: Error) => log(`память: ${e.message}`));
      await new Promise((r) => setTimeout(r, opts.pauseMs ?? 1100));
    }
  }
  return result;
}
