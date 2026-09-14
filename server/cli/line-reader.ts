/**
 * Построчный ввод из терминала без node:readline.
 *
 * readline в режиме терминала через `ssh -t` из Windows зависал после ввода кода
 * и стирал строку с вопросом. Здесь всё просто и предсказуемо:
 * - вопрос печатается и не стирается;
 * - конец строки — \r, \n или \r\n;
 * - скрытый ввод (пароль) не отображается;
 * - служебные последовательности терминала (вставка из буфера, стрелки) отбрасываются;
 * - Backspace стирает символ, Ctrl+C отменяет.
 * Работает и без терминала (ввод из пайпа) — тогда без эха, терминал не наш.
 */
import { StringDecoder } from "node:string_decoder";

type Input = NodeJS.ReadStream & { setRawMode?: (mode: boolean) => unknown };
type Output = { write(s: string): unknown };

export class CancelledError extends Error {
  constructor() {
    super("Отменено");
  }
}

// CSI (ESC [ … буква/~), SS3 (ESC O буква), одиночный ESC+символ
const ESCAPES = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1bO.|\x1b./g;

export class LineReader {
  private decoder = new StringDecoder("utf8");
  /** Символы, пришедшие после конца предыдущей строки. */
  private carry = "";
  /** Предыдущая строка кончилась на \r — следующий \n к ней относится. */
  private afterCR = false;
  private readonly tty: boolean;

  constructor(
    private input: Input,
    private output: Output,
  ) {
    this.tty = !!input.isTTY && typeof input.setRawMode === "function";
  }

  ask(question: string, hidden = false): Promise<string> {
    this.output.write(question);
    return new Promise((resolve, reject) => {
      let line = "";

      const finish = () => {
        this.input.off("data", onData);
        this.input.off("end", onEnd);
        this.input.pause();
        if (this.tty) this.input.setRawMode!(false);
      };

      /** true — строка готова, дальше не читаем. */
      const consume = (text: string): boolean => {
        const chars = [...text.replace(ESCAPES, "")];
        for (let i = 0; i < chars.length; i++) {
          const ch = chars[i];
          if (ch === "\n" && this.afterCR) {
            this.afterCR = false;
            continue;
          }
          this.afterCR = false;
          if (ch === "\r" || ch === "\n") {
            this.afterCR = ch === "\r";
            this.carry = chars.slice(i + 1).join("");
            if (this.tty) this.output.write("\r\n");
            finish();
            resolve(line);
            return true;
          }
          // Ctrl+C, Ctrl+D
          if (ch === "" || ch === "") {
            if (this.tty) this.output.write("\r\n");
            finish();
            reject(new CancelledError());
            return true;
          }
          // Backspace: DEL или BS
          if (ch === "" || ch === "\b") {
            if (line) {
              line = [...line].slice(0, -1).join("");
              if (this.tty && !hidden) this.output.write("\b \b");
            }
            continue;
          }
          if (ch < " ") continue;
          line += ch;
          if (this.tty && !hidden) this.output.write(ch);
        }
        return false;
      };

      const onData = (chunk: Buffer | string) => {
        consume(typeof chunk === "string" ? chunk : this.decoder.write(chunk));
      };
      // Ввод кончился (пайп закрыт) — отдаём то, что успели набрать
      const onEnd = () => {
        finish();
        resolve(line);
      };

      if (this.carry) {
        const pending = this.carry;
        this.carry = "";
        if (consume(pending)) return;
      }
      if (this.tty) this.input.setRawMode!(true);
      this.input.on("data", onData);
      this.input.on("end", onEnd);
      this.input.resume();
    });
  }

  close(): void {
    if (this.tty) this.input.setRawMode!(false);
    this.input.pause();
  }
}
