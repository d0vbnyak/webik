/**
 * Что бот принимает от Telegram: нажатия «Не то» / «Вернуть» под заказами и
 * команду /stats. Слушает только свой чат (FREELANCE_CHAT_ID): чужие сообщения
 * и нажатия молча игнорируются — бота может найти кто угодно.
 *
 * Обновления забираются через getUpdates: вебхук не нужен, и бот работает
 * с любого компьютера без открытых портов.
 */
import { bump, statsText, type State } from "./state";
import { rejectButton, undoButton, type TelegramApi } from "./telegram";

export type Update = {
  update_id: number;
  message?: { chat: { id: number }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } };
};

export type BotContext = {
  api: TelegramApi;
  state: State;
  chatId: string;
  sourceNames: string[];
  persist: () => Promise<void>;
  log: (line: string) => void;
};

export const COMMANDS = [{ command: "stats", description: "Сколько заказов прочитано и прислано, как читаются площадки" }];

const HELP =
  "Присылаю новые заказы с FL.ru, Kwork и freelance.ru по темам студии.\n\n" +
  "«Не то» под заказом — такие заказы перестанут приходить, когда наберётся несколько похожих.\n" +
  "/stats — сколько прочитано и прислано, какие площадки не читаются.";

export async function handleUpdate(u: Update, ctx: BotContext): Promise<void> {
  const { api, state } = ctx;

  if (u.callback_query) {
    const q = u.callback_query;
    if (!q.message || String(q.message.chat.id) !== ctx.chatId) {
      await api("answerCallbackQuery", { callback_query_id: q.id });
      return;
    }
    const [, action, key] = q.data?.match(/^(no|undo):(.+)$/) ?? [];
    const marked = state.rejected.some((r) => r.key === key);
    if (action === "no" && !marked) {
      state.rejected.push({ key, at: new Date().toISOString() });
      bump(state, "rejected");
    } else if (action === "undo" && marked) {
      state.rejected = state.rejected.filter((r) => r.key !== key);
      bump(state, "rejected", -1);
    }
    await ctx.persist();
    await api("answerCallbackQuery", {
      callback_query_id: q.id,
      text: action === "no" ? "Запомнил. Когда наберётся несколько похожих — такие перестанут приходить" : action ? "Вернул" : "",
    });
    if (action) {
      // Повторное нажатие на ту же кнопку: «message is not modified» — не ошибка
      await api("editMessageReplyMarkup", {
        chat_id: ctx.chatId,
        message_id: q.message.message_id,
        reply_markup: action === "no" ? undoButton(key) : rejectButton(key),
      }).catch((e: Error) => {
        if (!/not modified/i.test(e.message)) throw e;
      });
    }
    return;
  }

  const m = u.message;
  if (!m || String(m.chat.id) !== ctx.chatId) return;
  const command = m.text?.trim().split(/[\s@]/)[0];
  const text = command === "/stats" ? statsText(state, ctx.sourceNames) : HELP;
  await api("sendMessage", { chat_id: ctx.chatId, text });
}

/**
 * Забрать и обработать накопившиеся обновления. waitSec > 0 — длинный опрос:
 * Telegram держит запрос, пока что-нибудь не придёт.
 */
export async function pollUpdates(ctx: BotContext, waitSec: number): Promise<void> {
  const updates = await ctx.api<Update[]>(
    "getUpdates",
    { offset: ctx.state.updateOffset, timeout: waitSec, allowed_updates: ["message", "callback_query"] },
    (waitSec + 15) * 1000,
  );
  for (const u of updates) {
    // offset сдвигается до обработки: упавшее обновление не будет повторяться вечно
    ctx.state.updateOffset = u.update_id + 1;
    await handleUpdate(u, ctx).catch((e: Error) => ctx.log(`обновление ${u.update_id}: ${e.message}`));
  }
  if (updates.length) await ctx.persist();
}
