// Минимальная шина событий для рассинхрона между компонентами: когда данные
// меняются «в обход» хука (например, авто-добавление повторяющихся расходов
// при загрузке), хук подписан и перечитывает себя.

type Channel = "expenses";

const target = new EventTarget();

export function emitChange(channel: Channel) {
  target.dispatchEvent(new Event(channel));
}

/** Подписка на изменения канала. Возвращает функцию отписки. */
export function onChange(channel: Channel, handler: () => void): () => void {
  target.addEventListener(channel, handler);
  return () => target.removeEventListener(channel, handler);
}
