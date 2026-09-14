/** Общие для dev и прода мелочи HTTP-слоя. */
import type { Context } from "hono";
import type { HttpBindings } from "@hono/node-server";

/**
 * Адрес клиента для лимита входа.
 * - Без прокси — адрес сокета: заголовкам верить нельзя, они подделываются.
 * - За своим прокси (Caddy) — последний адрес в X-Forwarded-For: его дописал
 *   сам прокси, а всё левее мог прислать клиент.
 */
export function clientIp(c: Context<{ Bindings: HttpBindings }>, trustProxy: boolean): string {
  const socket = c.env?.incoming?.socket?.remoteAddress ?? "unknown";
  if (!trustProxy) return socket;
  const forwarded = c.req.header("x-forwarded-for");
  const last = forwarded?.split(",").pop()?.trim();
  return last || socket;
}
