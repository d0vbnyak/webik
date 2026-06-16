# Закрытая админ-панель «Статистика» на Supabase — дизайн

**Дата:** 2026-06-16
**Epic:** WebIK-cvn
**Статус:** одобрено пользователем (навигация — нижняя панель с иконками)

## Цель

Встроить в существующий сайт WebIK (React 19 + React Router 7 + Vite 7 + Tailwind 4 +
Motion 12) закрытый раздел `/admin` для учёта финансов и клиентов веб-студии. Бэкенд —
Supabase (Auth + Postgres + RLS), своего сервера нет. **Основной сайт не меняется** —
панель встраивается как отдельный защищённый раздел.

## Принятые решения (то, что спецификация оставила на исполнителя)

1. **Графики:** `recharts`, грузится лениво (`lazy`) только внутри раздела статистики —
   на публичный бандл сайта не влияет.
2. **Тесты:** `vitest`. Покрываем юнит-тестами только чистые функции денежно-датной
   логики (телефон, налог, просрочка, остаток, перенос повторяющихся). UI — сборкой и
   браузером.
3. **Навигация:** единая **нижняя панель с иконками** (bottom tab bar) и на мобильном,
   и на десктопе. На мобильном — только иконки, без выдвижного меню.
4. **Интеграция в роутер:** один ленивый маршрут верхнего уровня `/admin/*` в обход
   публичного `SiteLayout` (как уже сделаны полноэкранные шаблоны). Публичной ссылки на
   `/admin` на сайте нет.
5. **Данные:** по одному хуку на сущность. Доходы/расходы запрашиваются с фильтром по
   диапазону выбранного месяца; клиенты, категории, шаблоны, цели, настройки — целиком.

## Архитектура

### Интеграция в роутер
В `src/App.tsx` добавляется верхнеуровневый маршрут:
```
<Route path="/admin/*" element={<Suspense><AdminApp /></Suspense>} />
```
`AdminApp` имеет собственные `<Routes>` и тёмную оболочку, **не** использует публичные
`Navbar`/`Footer`.

### Структура папок
```
src/admin/
  AdminApp.tsx          — роутер админки + провайдеры (Auth, Period)
  AdminLayout.tsx       — тёмная оболочка + нижняя навигация с иконками
  RequireAuth.tsx       — guard по сессии Supabase
  lib/
    supabase.ts         — типизированный клиент из env
    types.ts            — доменные интерфейсы + типы строк Supabase
    phone.ts            — нормализация телефона + ссылки мессенджеров  ┐ чистые
    finance.ts          — налог, просрочка, остаток к оплате           ├ функции
    recurring.ts        — перенос дат повторяющихся расходов           │ (тесты)
    dates.ts            — диапазон месяца, +1 месяц, форматирование    ┘
    *.test.ts           — Vitest
  context/   AuthContext.tsx, PeriodContext.tsx
  hooks/     useAuth, useClients, useExpenses, useIncomes,
             useRecurring, useGoals, useSettings, useCategories
  components/  Card, Field, MoneyInput, MonthSwitcher, StatCard,
               ProgressBar, Modal, MessengerButtons, BottomNav, ...
  pages/     Login, Dashboard, Incomes, Expenses, Recurring,
             Clients, Stats, Settings
```

### Тёмная тема
Фон `zinc-950/900`, карточки `rounded-2xl` с границами `zinc-800`, акцент — фирменный
`brand-green #9fff00`, шрифты Inter/Outfit (как на сайте). Анимации минимальные.
**Mobile-first**: сначала мобильная раскладка, затем десктоп через `min-width`-брейкпоинты.

## Безопасность

- **Supabase Auth** — вход по email + паролю.
- Anon-ключ виден в коде фронтенда, поэтому реальную защиту даёт **RLS**, а не секретность
  ключа/пути:
  - RLS включён на всех таблицах;
  - в каждой таблице `user_id uuid default auth.uid()`;
  - политики `select/insert/update/delete` разрешают доступ только к строкам
    `user_id = auth.uid()`.
- Публичная регистрация отключается в настройках Supabase Auth; единственный аккаунт
  создаётся вручную через дашборд.
- Клиент Supabase типизирован; URL и anon-ключ — из `import.meta.env.VITE_SUPABASE_URL`
  и `VITE_SUPABASE_ANON_KEY`. `.env` добавляется в `.gitignore`, в репозиторий не коммитится;
  создаётся `.env.example`.

### Авторизация и защита маршрутов
`AuthContext` при монтировании вызывает `getSession()` и подписывается на
`onAuthStateChange`. `RequireAuth`: пока `loading` — спиннер; нет сессии —
`<Navigate to="/admin/login">`; есть — рендерит защищённый раздел. Защита по реальной
проверке сессии, а не скрытием UI.

## Структура БД

- **clients**: id, user_id, name (text), phone (text, null), telegram_username (text, null),
  max_link (text, null), created_at.
- **expenses**: id, user_id, amount (numeric), date (date), category (text),
  comment (text, null), recurring_id (uuid, null → recurring_expenses), created_at.
- **incomes**: id, user_id, amount (numeric — полная стоимость), date (date), category (text),
  client_id (uuid, null → clients.id), payment_status ('paid'|'unpaid'|'partial'),
  paid_amount (numeric, default 0), due_date (date, null), comment (text, null), created_at.
- **categories**: id, user_id, type ('expense'|'income'), name (text).
- **recurring_expenses**: id, user_id, name (text), amount (numeric), category (text),
  next_charge_date (date), reminder_days_before (int, default 3), active (bool, default true),
  created_at.
- **goals**: id, user_id, year (int), month (int 1-12), target_amount (numeric).
- **settings**: id, user_id, tax_rate (numeric, default 6), default_monthly_goal (numeric, null).
  Одна строка на пользователя.

**Сиды при первом входе:**
- categories expense: Реклама, ИИ, Сервисы и подписки, Прочее
- categories income: Веб, Боты, SEO
- settings: строка с tax_rate = 6

## Функциональные разделы

### Расходы
Форма: сумма (>0), дата (по умолч. сегодня), категория (из categories type='expense',
редактируемый список), комментарий. Список с редактированием и удалением.

### Повторяющиеся расходы
Шаблон: название, сумма, категория, дата следующего списания, за сколько дней напоминать,
вкл/выкл. **Авто-добавление** при загрузке: для каждого активного шаблона, пока
`next_charge_date <= сегодня` — если расхода с этим `recurring_id` на эту дату ещё нет,
создать обычный расход (с `recurring_id`) и сдвинуть `next_charge_date` на месяц вперёд
(сразу сохранить). Проверка существования + сохранённая дата = без дублей.
**Напоминания:** если до `next_charge_date` осталось `<= reminder_days_before` дней — показ
на дашборде. Честно отметить в инструкции: пока вкладка закрыта, фронтенд не выполняется,
поэтому реальные фоновые напоминания требуют планировщика (Edge Function по cron /
Telegram-бот). Сейчас — в момент открытия приложения.

### Доходы (с дебиторкой)
Форма: сумма (полная стоимость, >0), дата, категория (Веб/Боты/SEO, редактируемый), клиент
(необязательно), комментарий, статус оплаты (оплачено/не оплачено/частично), paid_amount,
due_date (необязательно). При `paid` → `paid_amount = amount`. «Просрочено» динамически:
`due_date < сегодня И не оплачено полностью`. Список с редактированием, удалением, фильтром
по статусу.

### Дебиторка
Виджет «Кто должен»: неоплаченные и частичные доходы, остаток (amount − paid_amount),
просроченные подсвечены. Быстрая отметка «оплачено» из списка.

### Клиенты
Поля: имя (обязательно), телефон (null), telegram_username (null, без @), max_link (null).
Кнопки мессенджеров (логика строго):
- Нормализация телефона: убрать всё кроме цифр; если начинается с 8 (РФ) → заменить на 7.
- WhatsApp: `https://wa.me/<номер>` — только если есть телефон.
- Telegram: если username → `https://t.me/<username>`; иначе если телефон →
  `tg://resolve?phone=<номер>`. Показывать при username ИЛИ телефоне.
- MAX: ссылка = max_link — только если заполнен.
- Все ссылки: `target="_blank" rel="noopener noreferrer"`.

### Цели по доходу
Цель на конкретный месяц (goals: year+month+target_amount). Если не задана — используется
`settings.default_monthly_goal`. Прогресс — на дашборде (полоса, %, сколько осталось).

### Налоги («конверт на налог»)
Ставка — `settings.tax_rate` (по умолч. 6%). Резерв = tax_rate% от полученного дохода
(сумма `paid_amount`) за период. Показывать как «отложить на налог».

### Дашборд (стартовая страница)
За выбранный месяц одним экраном: доход (полная стоимость), получено (Σ paid_amount),
дебиторка (остаток), расход, прибыль (доход − расход), резерв на налог, прогресс к цели
(полоса), ближайшие/просроченные платежи, напоминания по повторяющимся. Вверху —
переключатель месяца/года (влияет на дашборд и статистику).

### Статистика
Переключатель месяца/года (стрелки + выбор любого прошлого). Сводка за месяц (доход, расход,
прибыль). Разбивка доходов по категориям и расходов по категориям. График динамики
дохода/расхода/прибыли по месяцам (recharts, lazy).

## Маршруты
`/admin` (дашборд), `/admin/incomes`, `/admin/expenses`, `/admin/recurring`,
`/admin/clients`, `/admin/stats`, `/admin/settings`, `/admin/login`. Guard — редирект на
`/admin/login` без активной сессии.

## Технические требования
Строгая типизация (интерфейсы Client, Expense, Income, RecurringExpense, Goal, Settings,
Category + типы строк Supabase). Все обращения к Supabase — с обработкой ошибок и состояниями
загрузки. Валидация форм, корректная работа с numeric (деньги) и date. Чистая структура:
компоненты + хуки. TS строгий (`verbatimModuleSyntax` → `import type`; `noUnusedLocals`).

## Тестирование (Vitest)
Юнит-тесты на чистые функции `lib/`:
- `phone.ts`: нормализация (8→7, мусор), сборка ссылок WhatsApp/Telegram/MAX по правилам видимости.
- `finance.ts`: просрочка (due_date < сегодня и не оплачено), остаток (amount − paid_amount),
  резерв на налог (tax_rate% от Σ paid_amount).
- `recurring.ts`: перенос next_charge_date на месяц, дедуп по (recurring_id, date), напоминание.
- `dates.ts`: диапазон месяца, +1 месяц (включая переход через год / конец месяца).

Скрипт `npm run test` (`vitest run`).

## Что отдать пользователю в конце
1. npm-пакеты: `@supabase/supabase-js`, `recharts`; dev: `vitest`.
2. Полный SQL: таблицы + RLS + политики «только свои строки» + сиды категорий и settings.
3. `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — где взять, `.env` в `.gitignore`.
4. Как отключить публичную регистрацию и создать аккаунт вручную.
5. Куда вписаны маршруты и как связаны с роутером WebIK.
6. Как работает авто-добавление повторяющихся и почему «фоновые» напоминания при закрытой
   вкладке требуют отдельного планировщика.

## Замечания по окружению
- Git remote не настроен — коммиты локальные, без push.
- Деньги (`numeric`) на фронте — `number` (рубли с 2 знаками, точности JS достаточно).
