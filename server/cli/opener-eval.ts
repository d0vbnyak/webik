/**
 * Замер моделей для первой строки письма — на настоящем createOpener.
 *
 *   npx tsx server/cli/opener-eval.ts <компании.json> [модель,модель,...] [отчёт.json]
 *
 * Файл компаний — массив { company, city, website, hook?, variant?, first_line? };
 * hook, variant и first_line — написанные вручную, для сравнения глазами.
 * Выгрузить из outreach/компании.xlsx можно любым способом, лишь бы поля совпали.
 *
 * Нужны YANDEX_API_KEY и YANDEX_FOLDER_ID. Тратит деньги аккаунта: около
 * 1–2 ₽ за компанию на одну модель. Сайт каждой компании читается один раз и
 * переиспользуется для всех моделей. Лимит частоты на время замера снят.
 * REASONING=none|minimal|low|… — reasoning_effort, OPENER_DEBUG=1 — токены каждого вызова.
 */
import { readFile, writeFile } from "node:fs/promises";
import { DEFAULT_OPENER_MODEL, OPENER_LIMITS, createOpener, type OpenerResult } from "../ai/opener";
import { readSite, type SiteText } from "../ai/site";
import { yandexFromEnv } from "../ai/yandex";

type Company = { company: string; city: string | null; website: string; hook?: string; variant?: string; first_line?: string };

const [file, modelsArg, reportPath] = process.argv.slice(2);
if (!file) {
  console.error("Использование: npx tsx server/cli/opener-eval.ts <компании.json> [модель,...] [отчёт.json]");
  process.exit(1);
}
const access = yandexFromEnv(process.env);
if (!access) {
  console.error("Нужны YANDEX_API_KEY и YANDEX_FOLDER_ID");
  process.exit(1);
}

const companies = JSON.parse(await readFile(file, "utf8")) as Company[];
const models = (modelsArg ?? DEFAULT_OPENER_MODEL).split(",").map((m) => m.trim()).filter(Boolean);
(OPENER_LIMITS as { perWindow: number }).perWindow = 1000;

// Сайт читается один раз — модели сравниваются на одинаковом тексте
const sites = new Map<string, Promise<SiteText>>();
const cachedRead = (website: string) => {
  if (!sites.has(website)) sites.set(website, readSite(website));
  return sites.get(website)!;
};

// Сайты читаются заранее, по 4 за раз: время модели в замере не смешивается со временем сайта
{
  const queue = [...new Set(companies.map((c) => c.website))];
  const started = Date.now();
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let w = queue.shift(); w; w = queue.shift()) await cachedRead(w).catch(() => null);
    }),
  );
  console.log(`Сайты прочитаны за ${((Date.now() - started) / 1000).toFixed(1)} с`);
}

type Row = { company: string; model: string; ms: number; result?: OpenerResult; error?: string };
const rows: Row[] = [];

for (const model of models) {
  const reasoningEffort = process.env.REASONING as Parameters<typeof createOpener>[0]["reasoningEffort"];
  const opener = createOpener({ yandex: access, model, readSite: cachedRead, reasoningEffort });
  let spent = 0;
  let found = 0;
  let clean = 0;
  let failed = 0;
  console.log(`\n=== ${model} ===`);
  for (const c of companies) {
    const started = Date.now();
    try {
      const result = await opener({ company: c.company, city: c.city, website: c.website });
      const ms = Date.now() - started;
      rows.push({ company: c.company, model, ms, result });
      spent += result.costRub;
      if (result.quoteFound) found += 1;
      if (result.warnings.length === 0) clean += 1;
      console.log(`\n— ${c.company} (${c.website}) · ${result.source} · ${result.costRub.toFixed(2)} ₽ · ${(ms / 1000).toFixed(1)} с`);
      console.log(`  ИИ:    [${result.variant}, ниша: ${result.fit}] ${result.first_line}`);
      console.log(`  цитата${result.quoteFound ? " ✓" : " ✗"}: ${result.quote}`);
      if (c.first_line) console.log(`  руками: [${c.variant ?? "—"}] ${c.first_line}`);
      for (const w of result.warnings) console.log(`  ⚠ ${w}`);
    } catch (e) {
      failed += 1;
      const ms = Date.now() - started;
      rows.push({ company: c.company, model, ms, error: (e as Error).message });
      console.log(`\n— ${c.company} (${c.website}) · ОШИБКА за ${(ms / 1000).toFixed(1)} с: ${(e as Error).message}`);
    }
  }
  const done = companies.length - failed;
  const avgMs = rows.filter((r) => r.model === model).reduce((s, r) => s + r.ms, 0) / Math.max(1, companies.length);
  console.log(
    `\n${model}: ${done}/${companies.length} готово, цитата найдена ${found}/${done}, без замечаний ${clean}/${done}, ` +
      `${spent.toFixed(2)} ₽ (${(spent / Math.max(1, done)).toFixed(2)} ₽ за компанию), в среднем ${(avgMs / 1000).toFixed(1)} с`,
  );
}

if (reportPath) {
  await writeFile(reportPath, JSON.stringify(rows, null, 1), "utf8");
  console.log(`\nОтчёт: ${reportPath}`);
}
