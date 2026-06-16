// Работа с датами (строки YYYY-MM-DD) и форматирование денег.
// Все функции — чистые, покрыты dates.test.ts.

const pad = (n: number) => String(n).padStart(2, "0");

/** Полуинтервал месяца [start, endExclusive) для запросов по диапазону дат. */
export function monthRange(year: number, month: number): { start: string; endExclusive: string } {
  const start = `${year}-${pad(month)}-01`;
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  const endExclusive = `${ny}-${pad(nm)}-01`;
  return { start, endExclusive };
}

/**
 * Сдвиг даты на месяц вперёд с клампингом к последнему дню месяца (31.01 → 28.02).
 * ВНИМАНИЕ (осознанное ограничение): «якоря» дня нет — после клампинга в коротком
 * месяце день фиксируется на меньшем значении и НЕ возвращается к концу месяца при
 * следующих сдвигах (31.01 → 28.02 → 28.03 → …, а не → 31.03). Для повторяющихся
 * расходов это означает дрейф к 28-му числу при старте с конца месяца. Допустимо для
 * текущей задачи; при необходимости точных «концов месяца» хранить день-якорь отдельно.
 */
export function addMonthISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const lastDay = new Date(ny, nm, 0).getDate(); // день 0 след. месяца = последний день nm
  const day = Math.min(d, lastDay);
  return `${ny}-${pad(nm)}-${pad(day)}`;
}

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const MONTHS_SHORT = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
];

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export function monthShort(month: number): string {
  return MONTHS_SHORT[month - 1];
}

/** Деньги в рублях: целые без копеек, дробные с двумя знаками, разделитель тысяч. */
export function formatMoney(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const hasFraction = rounded % 1 !== 0;
  const formatted = rounded
    .toLocaleString("ru-RU", {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    })
    // ru-RU разделяет тысячи неразрывным/узким пробелом — нормализуем к обычному
    .replace(/[  ]/g, " ");
  return `${formatted} ₽`;
}

/** Дата в формате ДД.ММ.ГГГГ для отображения. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Сегодняшняя дата как YYYY-MM-DD (локальная). */
export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
