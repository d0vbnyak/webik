import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { CancelledError, LineReader } from "./line-reader";

/** Терминал-заглушка: raw-режим включается и выключается, вывод копится. */
function fakeTty() {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (m: boolean) => void; raw: boolean };
  input.isTTY = true;
  input.raw = false;
  input.setRawMode = (m: boolean) => {
    input.raw = m;
  };
  let out = "";
  const output = { write: (s: string) => (out += s) };
  return { input, output, reader: new LineReader(input as never, output), out: () => out };
}

describe("LineReader", () => {
  it("вопрос не стирается, эхо обычного ввода, \\r завершает строку", async () => {
    const t = fakeTty();
    const p = t.reader.ask("Email: ");
    t.input.write("a@b.ru\r");
    expect(await p).toBe("a@b.ru");
    expect(t.out()).toBe("Email: a@b.ru\r\n");
    expect(t.input.raw).toBe(false);
  });

  it("скрытый ввод не отображается; \\r\\n считается одним концом строки", async () => {
    const t = fakeTty();
    const p1 = t.reader.ask("Пароль: ", true);
    t.input.write("secret password\r\n");
    expect(await p1).toBe("secret password");
    expect(t.out()).toBe("Пароль: \r\n");
    // \n от предыдущего \r\n не должен дать пустую строку
    const p2 = t.reader.ask("Ещё раз: ", true);
    t.input.write("secret password\r");
    expect(await p2).toBe("secret password");
  });

  it("несколько строк одним куском — каждая достаётся своему вопросу", async () => {
    const t = fakeTty();
    const p1 = t.reader.ask("1: ");
    t.input.write("один\nдва\n");
    expect(await p1).toBe("один");
    expect(await t.reader.ask("2: ")).toBe("два");
  });

  it("кириллица, разрезанная между кусками, собирается верно", async () => {
    const t = fakeTty();
    const p = t.reader.ask("? ");
    const bytes = Buffer.from("д\r");
    t.input.write(bytes.subarray(0, 1));
    t.input.write(bytes.subarray(1));
    expect(await p).toBe("д");
  });

  it("вставка из буфера (bracketed paste) и стрелки отбрасываются, Backspace стирает", async () => {
    const t = fakeTty();
    const p = t.reader.ask("Код: ");
    t.input.write("\x1b[200~570061\x1b[201~\x1b[D1\x7f\r");
    expect(await p).toBe("570061");
  });

  it("Ctrl+C — отмена", async () => {
    const t = fakeTty();
    const p = t.reader.ask("Email: ");
    t.input.write("");
    await expect(p).rejects.toBeInstanceOf(CancelledError);
  });

  it("без терминала (пайп): без эха, конец ввода отдаёт набранное", async () => {
    const input = new PassThrough();
    let out = "";
    const reader = new LineReader(input as never, { write: (s: string) => (out += s) });
    const p = reader.ask("Email: ");
    input.end("x@y.ru");
    expect(await p).toBe("x@y.ru");
    expect(out).toBe("Email: ");
  });
});
