/**
 * Создать админа или сменить пароль существующему. Заодно — включить вход по
 * коду из приложения (TOTP). Пароль вводится в терминале, в аргументы и
 * переменные окружения его не передавать.
 *
 *   npm run admin:create                 — база из DATABASE_URL
 *   npm run admin:create -- --pglite     — локальная база разработки (.data/pglite)
 *   В контейнере: docker compose exec -it app node build/create-admin.mjs
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { createPgDb, createPgliteDb, migrate, pendingMigrations } from "../db/db";
import { PASSWORD_MIN, createUser, normalizeEmail } from "../api/auth";
import { generateTotpSecret, otpauthUri, verifyTotp } from "../api/totp";

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

const yes = (s: string) => /^(д|да|y|yes)$/i.test(s.trim());

const usePglite = process.argv.includes("--pglite");
if (!usePglite && !process.env.DATABASE_URL) {
  console.error("Не задан DATABASE_URL (или запустите с --pglite для локальной базы)");
  process.exit(1);
}

const db = usePglite ? await createPgliteDb(".data/pglite") : await createPgDb(process.env.DATABASE_URL!);
try {
  // Миграции в проде применяет только сервер при старте — CLI лишь проверяет,
  // чтобы два процесса не накатывали их одновременно
  if (usePglite) await migrate(db);
  else if ((await pendingMigrations(db)).length > 0) throw new Error("Схема базы не обновлена — сначала запустите сервер");
  const email = normalizeEmail(await ask("Email: "));
  const [existing] = await db.query<{ id: string; totp_secret: string | null }>(
    "select id, totp_secret from users where email = $1",
    [email],
  );
  const others = await db.query<{ email: string }>("select email from users where email <> $1", [email]);

  if (existing) {
    if (!yes(await ask(`Пользователь ${email} уже есть. Сменить пароль? Все его сессии и устройства сбросятся. [д/н] `))) {
      throw new Error("Отменено");
    }
  } else if (others.length > 0) {
    const list = others.map((o) => o.email).join(", ");
    if (!yes(await ask(`Такого email нет. Уже есть: ${list}. Создать ещё одного админа ${email}? [д/н] `))) {
      throw new Error("Отменено — проверьте email на опечатку");
    }
  }

  const password = await ask(`Пароль (не короче ${PASSWORD_MIN} символов): `, true);
  const again = await ask("Ещё раз: ", true);
  if (password !== again) throw new Error("Пароли не совпали");

  let totpSecret: string | null | undefined;
  let totpStep: number | null = null;
  const totpQuestion = existing?.totp_secret
    ? "Код из приложения уже включён. Выпустить новый секрет (старый перестанет работать)? [д/н] "
    : "Включить вход по коду из приложения (Яндекс Ключ, Google Authenticator)? Рекомендуется. [д/н] ";
  if (yes(await ask(totpQuestion))) {
    const secret = generateTotpSecret();
    console.log("\nДобавьте в приложение аккаунт вручную:");
    console.log(`  Ключ:  ${secret.match(/.{1,4}/g)!.join(" ")}`);
    console.log(`  или ссылка otpauth (можно превратить в QR): ${otpauthUri(secret, email)}\n`);
    const code = await ask("Введите 6-значный код из приложения для проверки: ");
    totpStep = verifyTotp(secret, code.trim(), null);
    if (totpStep === null) throw new Error("Код не подошёл — ничего не сохранено, запустите заново");
    totpSecret = secret;
  }

  // Проверенный здесь код сразу помечается использованным — войти им повторно нельзя
  const user = await createUser(db, email, password, { totpSecret, totpStep });
  console.log(
    `${user.created ? "Создан" : "Пароль изменён"}: ${user.email}.` +
      (totpSecret ? " Вход по коду включён." : "") +
      (user.created ? "" : " Старые сессии и доверенные устройства сброшены."),
  );
} catch (e) {
  console.error(`Ошибка: ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  rl.close();
  await db.close();
}
