import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SiteError,
  checkUrl,
  decodeHtml,
  extractText,
  fetchPage,
  homepageCandidates,
  isBlockedAddress,
  readSite,
} from "./site";

describe("защита от SSRF", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.17.0.2", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "::1", "::", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "64:ff9b::a00:1",
    "::ffff:0:7f00:1", "fec0::1", "192.88.99.1",
    "не адрес",
  ])("внутренний адрес %s запрещён", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(["77.88.55.88", "5.255.255.242", "2a02:6b8::2:242"])("публичный адрес %s разрешён", (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });

  it.each([
    "ftp://example.ru/",
    "file:///etc/passwd",
    "http://user:pass@example.ru/",
    "http://example.ru:8080/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://2130706433/", // 127.0.0.1 числом — URL сам переводит в точечную запись
    "http://localhost/",
  ])("адрес %s отклоняется до запроса, поиск по нему не нужен", (raw) => {
    expect(() => checkUrl(new URL(raw))).toThrow(expect.objectContaining({ searchable: false }));
  });

  it("обычный адрес проходит", () => {
    expect(() => checkUrl(new URL("https://ohrana-servis.ru/uslugi"))).not.toThrow();
  });

  describe("на живом локальном сервере", () => {
    let server: Server;
    let port = 0;
    beforeAll(async () => {
      server = createServer((_req, res) => res.end("<html><body>секрет</body></html>"));
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
      port = (server.address() as AddressInfo).port;
    });
    afterAll(() => new Promise<void>((r) => server.close(() => r())));

    it("имя, которое резолвится в 127.0.0.1, не открывается", async () => {
      // «localhost.» с точкой проходит checkUrl — отсекать его должен резолв соединения.
      // Где такое имя не резолвится (бывает на Windows), ошибка другая, но тоже отказ
      await expect(fetchPage(new URL("http://localhost./"))).rejects.toThrow(/внутреннюю сеть|не найден/);
    });

    it("порт локального сервера нестандартный — отказ без соединения", async () => {
      await expect(fetchPage(new URL(`http://127.0.0.1:${port}/`))).rejects.toThrow(SiteError);
    });

    it("readSite не открывает localhost", async () => {
      await expect(readSite("localhost")).rejects.toThrow(SiteError);
    });
  });
});

describe("адрес сайта из CRM", () => {
  it("без схемы — сначала https, потом http", () => {
    expect(homepageCandidates(" ohrana.ru ").map((u) => u.href)).toEqual(["https://ohrana.ru/", "http://ohrana.ru/"]);
  });
  it("со схемой — как есть", () => {
    expect(homepageCandidates("http://ohrana.ru/main").map((u) => u.href)).toEqual(["http://ohrana.ru/main"]);
  });
  it("мусор — понятная ошибка", () => {
    expect(() => homepageCandidates("")).toThrow(SiteError);
    expect(() => homepageCandidates("ohrana ru")).toThrow(SiteError);
  });
});

describe("текст страницы", () => {
  it("windows-1251 из meta декодируется", () => {
    const html = '<html><head><meta charset="windows-1251"></head><body>Видеонаблюдение</body></html>';
    // Кодируем вручную: TextEncoder умеет только UTF-8. А–я → 0xC0–0xFF, Ё/ё — отдельно
    const cp1251 = Buffer.from(
      [...html].map((ch) => {
        const code = ch.charCodeAt(0);
        if (code < 128) return code;
        if (code === 0x401) return 0xa8;
        if (code === 0x451) return 0xb8;
        return code - 0x410 + 0xc0;
      }),
    );
    expect(decodeHtml(cp1251, "text/html")).toContain("Видеонаблюдение");
  });

  it("кодировка из заголовка важнее meta", () => {
    const html = '<meta charset="windows-1251"><p>привет</p>';
    expect(decodeHtml(Buffer.from(html, "utf8"), "text/html; charset=utf-8")).toContain("привет");
  });

  it("заголовок, описание, основной текст и ссылки на полезные страницы", async () => {
    const html = `<html><head><title>Охрана-Сервис</title>
      <meta name="description" content="Монтаж видеонаблюдения в Казани"></head>
      <body><nav><a href="/">Главная</a><a href="/o-kompanii/">О компании</a><a href="/uslugi">Услуги</a>
      <a href="https://vk.com/about">ВК</a><a href="/price.pdf">Услуги (pdf)</a><a href="/contacts">Контакты</a><a href="/about/contacts/">О нас: контакты</a></nav>
      <main><h1>Видеонаблюдение под ключ</h1><p>Бесплатный выезд инженера в день обращения.</p>
      <p>Более 300 объектов на пультовой охране.</p><script>alert(1)</script></main></body></html>`;
    const { text, links } = await extractText(html, new URL("https://www.ohrana.ru/"));
    expect(text).toContain("Заголовок: Охрана-Сервис");
    expect(text).toContain("Описание: Монтаж видеонаблюдения в Казани");
    expect(text).toContain("Бесплатный выезд инженера в день обращения.");
    expect(text).not.toContain("alert");
    expect(links.map((u) => u.href)).toEqual(["https://www.ohrana.ru/o-kompanii/", "https://www.ohrana.ru/uslugi"]);
  });
});
