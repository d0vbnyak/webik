/** Общие для dev и прода мелочи HTTP-слоя. */
import type { Context } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { lookup } from "node:dns/promises";

const normalize = (ip: string) => ip.replace(/^::ffff:/, "");

/**
 * Адрес клиента для лимита входа.
 * - Запрос пришёл не от доверенного прокси — адрес сокета: заголовки подделываются.
 * - От доверенного прокси (Caddy) — последний адрес в X-Forwarded-For: его
 *   дописал сам прокси, всё левее мог прислать клиент.
 */
export function clientIp(c: Context<{ Bindings: HttpBindings }>, isTrustedProxy: (ip: string) => boolean): string {
  const socket = normalize(c.env?.incoming?.socket?.remoteAddress ?? "unknown");
  if (!isTrustedProxy(socket)) return socket;
  const last = c.req.header("x-forwarded-for")?.split(",").pop()?.trim();
  return last ? normalize(last) : socket;
}

/**
 * Доверенный прокси по имени хоста в docker-сети (например, «caddy»). Адрес
 * контейнера меняется при пересоздании, поэтому имя перерезолвится раз в минуту.
 * Пока адрес не известен, не доверяем никому.
 */
export function trustedProxyByHost(host: string | undefined): (ip: string) => boolean {
  if (!host) return () => false;
  let addresses = new Set<string>();
  const refresh = async () => {
    try {
      const found = await lookup(host, { all: true });
      addresses = new Set(found.map((a) => normalize(a.address)));
    } catch (e) {
      console.error(`[http] не удалось найти прокси «${host}»:`, (e as Error).message);
    }
  };
  void refresh();
  setInterval(() => void refresh(), 60_000).unref();
  return (ip) => addresses.has(ip);
}
