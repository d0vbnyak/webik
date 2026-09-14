/**
 * Создать админа или сменить ему пароль. Пароль вводится в терминале и нигде не
 * сохраняется в открытом виде; смена пароля выкидывает все старые сессии.
 *
 *   npm run admin:create                 — база из DATABASE_URL
 *   npm run admin:create -- --pglite     — локальная база разработки (.data/pglite)
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { createPgDb, createPgliteDb, migrate } from "../db/db";
import { PASSWORD_MIN, createUser } from "../api/auth";

// Вывод, который можно заглушить, — чтобы пароль не печатался при наборе
let muted = false;
const output = new Writable({
  write(chunk, _enc, cb) {
    if (!muted) process.stdout.write(chunk);
    cb();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: true });

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    muted = hidden;
    rl.question("", (answer) => {
      muted = false;
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const usePglite = process.argv.includes("--pglite");
if (!usePglite && !process.env.DATABASE_URL) {
  console.error("Не задан DATABASE_URL (или запустите с --pglite для локальной базы)");
  process.exit(1);
}

const db = usePglite ? await createPgliteDb(".data/pglite") : await createPgDb(process.env.DATABASE_URL!);
try {
  await migrate(db);
  const email = (await ask("Email: ")).trim();
  const password = await ask(`Пароль (не короче ${PASSWORD_MIN} символов): `, true);
  const again = await ask("Ещё раз: ", true);
  if (password !== again) throw new Error("Пароли не совпали");
  const user = await createUser(db, email, password);
  console.log(`Готово: ${user.email}. Старые сессии этого пользователя сброшены.`);
} catch (e) {
  console.error(`Ошибка: ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  rl.close();
  await db.close();
}
