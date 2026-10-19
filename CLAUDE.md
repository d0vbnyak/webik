# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Build & Test

```bash
npm install
npm run dev          # сайт + API на PGlite + чат, http://localhost:5173
npm run build        # тайпчек фронтенда и server/ + shared/, сборка dist/
npm run build:server # серверный бандл build/main.mjs
npm test             # vitest
```

Node.js ставился через winget: если сессия не видит `node`, в Git Bash —
`export PATH="$PATH:/c/Program Files/nodejs"`.

Выкладка на https://webik.tech — `bash deploy/deploy.sh` (в PowerShell:
`& "C:\Program Files\Git\bin\bash.exe" deploy/deploy.sh`). Из агента выкладка
заблокирована классификатором прав — её запускает Сергей. Скрипт сам проверяет, что в
сборке нет ключей Anthropic, Yandex Cloud и токена Telegram.

## Architecture Overview

- **Фронтенд** — React 19 + Vite + Tailwind + TypeScript (`src/`). Админка — `src/admin`:
  студия редизайна — «Сегодня», «Проекты» (этапы плагина webik), «Деньги»,
  «Кандидаты» (фирмы со старыми сайтами для холодного поиска, импорт JSON),
  старая воронка ИИ-автоматизации — «Архив лидов». Палитра админки — переопределение
  серых Tailwind в `.admin-root` (`src/index.css`).
- **Плагин webik → админка** — `POST /api/webik/projects` по токену из настроек,
  `server/api/webik.ts`, общие правила этапов — `shared/projects.ts`. Протокол —
  `docs/webik-plugin-sync.md`.
- **Сервер** — Hono + PostgreSQL (`server/`): `main.ts` — прод (API, статика, чат),
  `api/` — API админки и формы заявки, `db/migrations/` — миграции, применяются при
  старте (применённую миграцию не править, новое — следующим файлом).
- **ИИ-ассистент** — `server/chat.ts`, модель `deepseek-v4-flash` в Yandex AI Studio
  через пакет `openai`. Включается при заданных `YANDEX_API_KEY` и `YANDEX_FOLDER_ID`,
  иначе виджет показывает форму. Подробности, замеры моделей и границы —
  `docs/chat-bot.md`, замер — `server/cli/chat-eval.ts` (тратит деньги).
- **ИИ в админке** — `server/ai/`: первая строка письма по сайту лида
  (`POST /api/ai/opener`, кнопка в карточке лида). Те же ключи Yandex; общий клиент
  и цены — `server/ai/yandex.ts`. Чтение сайтов защищено от SSRF (`server/ai/site.ts`).
  Подробности и замер — `docs/ai-admin.md`, замер — `server/cli/opener-eval.ts` (тратит деньги).
- **Заявки** — `server/orders.ts`: CRM, письмо, лимиты; общие для чата и формы.
- **Общее** — `shared/`: контакты, цены (`prices.json`), проверка заявки.
- **Прод** — docker compose на общем сервере рядом с чужим продом (`deploy/`),
  секреты в `/opt/webik/.env`. Правки на сервере — только с разрешения Сергея.

## Conventions & Patterns

### Mobile-first вёрстка (приоритет)

- **Сначала мобильная версия.** Любую новую страницу или компонент верстаем в первую очередь под мобильный экран — это приоритет.
- **Потом десктоп.** Десктопную раскладку добавляем поверх мобильной (адаптив через `min-width`-брейкпоинты Tailwind: `sm:`, `md:`, `lg:`…), а не наоборот.
- **Ревью обеих версий.** Перед завершением задачи проверяем и мобильную, и десктопную версию — обе должны выглядеть и работать корректно.

## Разделение ролей и ревью кода

Правило действует для всего проекта и для всех сессий.

### Роли и модели

- **Opus — главный исполнитель.** Архитектура, дизайн, вёрстка, фронтенд, общая
  логика сайта. Работает в основном режиме.
- **Sonnet — помощник.** Тексты, наполнение страниц, мелкие правки. Запускается
  Opus'ом как подагент на модели Sonnet; задачи ставит Opus.
- **Второй Opus — независимый ревьюер.** Отдельный подагент со свежим контекстом
  (видит только результат и git-диапазон, без истории основного чата).

### Поток работы над задачей

1. Opus планирует и делает основную работу (дизайн / фронтенд).
2. Тексты и мелкие задачи Opus делегирует Sonnet-подагенту.
3. **Заметные изменения** (дизайн, фронтенд, новые страницы, крупные правки)
   обязательно проходят код-ревью вторым Opus по навыку `requesting-code-review`.
   Мелкие текстовые правки и опечатки — без отдельного агента.
4. Opus исправляет критичные и важные замечания (при необходимости — повторное ревью).
5. **Двухступенчатое одобрение:**
   1. Второй Opus даёт «зелёный свет».
   2. Затем пользователь лично одобряет.
   Работа считается готовой только после обоих шагов.

### Технически

- Подагенты запускаются с явным выбором модели (`opus` / `sonnet`).
- Ревьюер получает только описание и git-диапазон — без переписки основного чата.
- Перед заявлением «готово» — всегда фактическая проверка (сборка / линт / браузер),
  затем ревью, затем одобрение.
