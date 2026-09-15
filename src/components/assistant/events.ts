/**
 * Открыть виджет ассистента из любого места сайта: кнопки «начать проект»,
 * поле задачи в герое, «запросить смету» в прайсе.
 *
 * Через событие окна, а не контекст: виджет живёт в лейауте, а кнопки — в
 * разных страницах, и протаскивать провайдер ради одного вызова незачем.
 */
const EVENT = "webik:assistant";

export type OpenAssistantDetail = { text?: string };

/** Открывает ассистента. `text` — задача посетителя: чату уйдёт сообщением, в форме подставится. */
export function openAssistant(text?: string): void {
  window.dispatchEvent(new CustomEvent<OpenAssistantDetail>(EVENT, { detail: { text } }));
}

export function onOpenAssistant(handler: (detail: OpenAssistantDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<OpenAssistantDetail>).detail ?? {});
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
