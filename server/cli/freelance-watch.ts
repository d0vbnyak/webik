/**
 * Бот-парсер заказов с фриланс-бирж: FL.ru, Kwork, freelance.ru → Telegram.
 *
 *   npm run freelance              проверять каждые 5 минут, пока не остановят
 *   npm run freelance -- --once    один проход (для планировщика задач)
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
 * Имена не TELEGRAM_*, как у заявок (server/orders.ts): так бот заказов не
 * перепутает чат с ботом заявок. Темы и стоп-слова — server/freelance/filter.ts.
 */
import { existsSync } from "node:fs";
import { ALL_SOURCES } from "../freelance/sources";
import { recentChats, telegram } from "../freelance/telegram";
import { checkOnce, loadSeen, saveSeen } from "../freelance/watch";

if (existsSync(".env.freelance")) process.loadEnvFile(".env.freelance");

const args = new Set(process.argv.slice(2));
const env = process.env;
const token = env.FREELANCE_BOT_TOKEN?.trim();
const chatId = env.FREELANCE_CHAT_ID?.trim();
const statePath = env.FREELANCE_STATE?.trim() || ".data/freelance-seen.json";
const minBudget = Number(env.FREELANCE_MIN_BUDGET ?? 0) || 0;
const intervalMin = Math.max(1, Number(env.FREELANCE_INTERVAL_MIN ?? 5) || 5);

const log = (line: string) => console.log(`${new Date().toLocaleTimeString("ru-RU")} ${line}`);

if (args.has("--chats")) {
  if (!token) throw new Error("Задайте FREELANCE_BOT_TOKEN");
  const chats = await recentChats(token);
  if (!chats.length) console.log("Боту ещё никто не писал. Откройте его в Telegram, нажмите «Старт» и повторите.");
  for (const c of chats) console.log(`${c.id}\t${c.name}`);
  process.exit(0);
}

const dry = args.has("--dry");
if (!dry && (!token || !chatId)) {
  console.error("Задайте FREELANCE_BOT_TOKEN и FREELANCE_CHAT_ID (или запустите с --dry)");
  process.exit(1);
}
const tg = dry ? null : telegram(token!, chatId!);

async function tick() {
  const seen = await loadSeen(statePath);
  const r = await checkOnce({ sources: ALL_SOURCES, seen, filter: { minBudget }, telegram: tg, log });
  if (tg) await saveSeen(statePath, seen);
  log(`заказов на площадках: ${r.found}, ${dry ? "подходит" : "отправлено"}: ${r.sent}${r.failedSources.length ? `, не прочитались: ${r.failedSources.join(", ")}` : ""}`);
}

if (dry || args.has("--once")) {
  await tick();
} else {
  log(`проверяю каждые ${intervalMin} мин; остановить — Ctrl+C`);
  for (;;) {
    await tick().catch((e: Error) => log(`проход не удался: ${e.message}`));
    await new Promise((r) => setTimeout(r, intervalMin * 60_000));
  }
}
