/**
 * Бот-парсер заказов с фриланс-бирж: FL.ru, Kwork, freelance.ru → Telegram.
 *
 *   npm run freelance              проверять каждые 5 минут, пока не остановят
 *   npm run freelance -- --once    один проход (для планировщика задач); нажатия кнопок
 *                                  и /stats обрабатываются в начале прохода
 *   npm run freelance -- --dry     показать подходящие заказы в консоли, ничего не слать
 *   npm run freelance -- --chats   узнать свой chat_id (сначала напишите боту /start)
 *
 * Переменные — в окружении или в файле .env.freelance в корне проекта:
 *   FREELANCE_BOT_TOKEN       токен бота от @BotFather
 *   FREELANCE_CHAT_ID         куда слать (свой chat_id, см. --chats)
 *   FREELANCE_MIN_BUDGET      не слать заказы дешевле, ₽; по умолчанию 0. Без бюджета — шлёт
 *   FREELANCE_INTERVAL_MIN    пауза между проверками, минут; по умолчанию 5
 *   FREELANCE_STATE           файл памяти; по умолчанию .data/freelance-seen.json
 *
 * В Telegram под каждым заказом — кнопка «Не то» (из отметок бот учится,
 * server/freelance/state.ts), команда /stats — счётчики и состояние площадок.
 *
 * Имена не TELEGRAM_*, как у заявок (server/orders.ts): так бот заказов не
 * перепутает чат с ботом заявок. Темы и стоп-слова — server/freelance/filter.ts.
 */
import { existsSync } from "node:fs";
import { COMMANDS, pollUpdates, type BotContext } from "../freelance/bot";
import { ALL_SOURCES } from "../freelance/sources";
import { loadState, saveState } from "../freelance/state";
import { recentChats, telegram, telegramApi } from "../freelance/telegram";
import { checkOnce } from "../freelance/watch";

if (existsSync(".env.freelance")) process.loadEnvFile(".env.freelance");

const args = new Set(process.argv.slice(2));
const env = process.env;
const token = env.FREELANCE_BOT_TOKEN?.trim();
const chatId = env.FREELANCE_CHAT_ID?.trim();
const statePath = env.FREELANCE_STATE?.trim() || ".data/freelance-seen.json";
const minBudget = Number(env.FREELANCE_MIN_BUDGET ?? 0) || 0;
const intervalMin = Math.max(1, Number(env.FREELANCE_INTERVAL_MIN ?? 5) || 5);

const log = (line: string) => console.log(`${new Date().toLocaleTimeString("ru-RU")} ${line}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

if (args.has("--chats")) {
  if (!token) throw new Error("Задайте FREELANCE_BOT_TOKEN");
  const chats = await recentChats(telegramApi(token));
  if (!chats.length) console.log("Боту ещё никто не писал. Откройте его в Telegram, нажмите «Старт» и повторите.");
  for (const c of chats) console.log(`${c.id}	${c.name}`);
  process.exit(0);
}

const dry = args.has("--dry");
if (!dry && (!token || !chatId)) {
  console.error("Задайте FREELANCE_BOT_TOKEN и FREELANCE_CHAT_ID (или запустите с --dry)");
  process.exit(1);
}

// Память одна на процесс: проход и нажатия кнопок меняют один и тот же объект
const state = await loadState(statePath);
const persist = () => saveState(statePath, state);
const api = dry ? null : telegramApi(token!);
const tg = api ? telegram(api, chatId!) : null;
const bot: BotContext | null = api
  ? { api, state, chatId: chatId!, sourceNames: ALL_SOURCES.map((s) => s.name), persist, log }
  : null;

async function tick() {
  const r = await checkOnce({ sources: ALL_SOURCES, state, filter: { minBudget }, telegram: tg, log, persist });
  if (tg) await persist();
  log(
    `заказов на площадках: ${r.found}, ${dry ? "подходит" : "отправлено"}: ${r.sent}` +
      (r.muted ? `, отсеяно по «Не то»: ${r.muted}` : "") +
      (r.failedSources.length ? `, не прочитались: ${r.failedSources.join(", ")}` : ""),
  );
}

if (bot) await bot.api("setMyCommands", { commands: COMMANDS }).catch((e: Error) => log(`команды: ${e.message}`));

if (dry || args.has("--once")) {
  if (bot) await pollUpdates(bot, 0).catch((e: Error) => log(`кнопки: ${e.message}`));
  await tick();
} else {
  log(`проверяю каждые ${intervalMin} мин; остановить — Ctrl+C`);
  // Кнопки и /stats — длинным опросом параллельно с проверками площадок
  void (async () => {
    for (;;) {
      await pollUpdates(bot!, 25).catch(async (e: Error) => {
        log(`кнопки: ${e.message}`);
        await sleep(10_000);
      });
    }
  })();
  for (;;) {
    await tick().catch((e: Error) => log(`проход не удался: ${e.message}`));
    await sleep(intervalMin * 60_000);
  }
}
