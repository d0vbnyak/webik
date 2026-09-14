-- ============================================================================
-- WebIK · Админ-панель «Статистика» — схема Supabase (Postgres)
-- Выполнить в Supabase → SQL Editor (New query → вставить → Run).
-- Скрипт идемпотентный: после обновления схемы (например, CRM) прогнать целиком
-- ещё раз — существующие таблицы и данные не трогаются, новые создаются.
-- Ограничение: новые КОЛОНКИ в уже существующей таблице так не появятся — для них
-- нужен отдельный `alter table … add column if not exists`.
--
-- Безопасность: anon-ключ виден во фронтенде, поэтому защиту обеспечивает RLS.
-- На каждой таблице включён RLS; user_id по умолчанию = auth.uid(); политики
-- разрешают доступ ТОЛЬКО к строкам текущего пользователя (user_id = auth.uid()).
-- ============================================================================

-- gen_random_uuid() (на Supabase обычно уже доступно; строка идемпотентна)
create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- Таблицы
-- ----------------------------------------------------------------------------

-- Клиенты
create table if not exists public.clients (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name               text not null,
  phone              text,
  telegram_username  text,
  max_link           text,
  created_at         timestamptz not null default now()
);

-- Повторяющиеся расходы (шаблоны)
create table if not exists public.recurring_expenses (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                  text not null,
  amount                numeric(14,2) not null check (amount >= 0),
  category              text not null,
  next_charge_date      date not null,
  reminder_days_before  int not null default 3 check (reminder_days_before >= 0),
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

-- Расходы
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount        numeric(14,2) not null check (amount >= 0),
  date          date not null,
  category      text not null,
  comment       text,
  recurring_id  uuid references public.recurring_expenses (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- Доходы (с дебиторкой и статусами оплаты)
create table if not exists public.incomes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount          numeric(14,2) not null check (amount >= 0),   -- полная стоимость работы
  date            date not null,
  category        text not null,
  client_id       uuid references public.clients (id) on delete set null,
  payment_status  text not null default 'unpaid' check (payment_status in ('paid','unpaid','partial')),
  paid_amount     numeric(14,2) not null default 0 check (paid_amount >= 0),
  due_date        date,
  comment         text,
  created_at      timestamptz not null default now()
);

-- Категории (редактируемые списки для расходов и доходов)
create table if not exists public.categories (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type     text not null check (type in ('expense','income')),
  name     text not null,
  unique (user_id, type, name)   -- защита от дублей + идемпотентный сид через upsert
);

-- Цели по доходу (план на конкретный месяц)
create table if not exists public.goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year           int not null,
  month          int not null check (month between 1 and 12),
  target_amount  numeric(14,2) not null check (target_amount >= 0),
  unique (user_id, year, month)
);

-- Настройки (одна строка на пользователя)
create table if not exists public.settings (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tax_rate             numeric(5,2) not null default 6,
  default_monthly_goal numeric(14,2),
  unique (user_id)
);

-- CRM: лиды воронки продаж (добавлено 14.09.2026).
-- Этапы и коды отказов — src/admin/lib/crm.ts, там же правила переходов.
create table if not exists public.leads (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company           text not null,
  inn               text,
  city              text,
  website           text,
  email             text,
  phone             text,
  contact_name      text,
  telegram_username text,
  other_channels    text,
  business          text,
  hook              text,
  variant           text,
  first_line        text,
  priority          int check (priority in (1, 2)),
  source            text,
  stage             text not null default 'new' check (stage in
                      ('new','sent','followup','replied','check','call','proposal','pilot','client','support','lost')),
  reached_stage     text not null default 'new' check (reached_stage in
                      ('new','sent','followup','replied','check','call','proposal','pilot','client','support')),
  lost_reason       text check (lost_reason in
                      ('not_fit','private','not_sold','volume','price','timing','decision_maker','trust','data','competitor','ghosted','no_reply')),
  next_step         text,
  next_step_date    date,
  deal_amount       numeric(14,2) check (deal_amount >= 0),
  client_id         uuid references public.clients (id) on delete set null,
  stage_changed_at  timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

-- CRM: история касаний по лиду (письма, звонки, созвоны, КП, смены этапа)
create table if not exists public.lead_touches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id     uuid not null references public.leads (id) on delete cascade,
  type        text not null check (type in ('email','followup','call','meeting','message','proposal','note','stage')),
  date        date not null,
  comment     text,
  created_at  timestamptz not null default now()
);

-- Индексы под частые выборки по периоду/пользователю
create index if not exists expenses_user_date_idx        on public.expenses (user_id, date);
create index if not exists incomes_user_date_idx         on public.incomes (user_id, date);
create index if not exists incomes_status_idx            on public.incomes (user_id, payment_status);
create index if not exists expenses_recurring_idx        on public.expenses (recurring_id);
create index if not exists recurring_user_active_idx     on public.recurring_expenses (user_id, active);
create index if not exists leads_user_next_step_idx      on public.leads (user_id, next_step_date);
create index if not exists lead_touches_lead_idx         on public.lead_touches (lead_id, date);

-- ----------------------------------------------------------------------------
-- Row Level Security: включаем на всех таблицах
-- ----------------------------------------------------------------------------
alter table public.clients            enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.expenses           enable row level security;
alter table public.incomes            enable row level security;
alter table public.categories         enable row level security;
alter table public.goals              enable row level security;
alter table public.settings           enable row level security;
alter table public.leads              enable row level security;
alter table public.lead_touches       enable row level security;

-- ----------------------------------------------------------------------------
-- Политики: доступ только к своим строкам (user_id = auth.uid())
-- По одной политике на действие. INSERT проверяет through with check; остальные — using.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients','recurring_expenses','expenses','incomes','categories','goals','settings',
    'leads','lead_touches'
  ]
  loop
    execute format('drop policy if exists "own_select" on public.%I;', t);
    execute format('drop policy if exists "own_insert" on public.%I;', t);
    execute format('drop policy if exists "own_update" on public.%I;', t);
    execute format('drop policy if exists "own_delete" on public.%I;', t);

    execute format(
      'create policy "own_select" on public.%I for select to authenticated using (auth.uid() = user_id);', t);
    execute format(
      'create policy "own_insert" on public.%I for insert to authenticated with check (auth.uid() = user_id);', t);
    execute format(
      'create policy "own_update" on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format(
      'create policy "own_delete" on public.%I for delete to authenticated using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- ============================================================================
-- СИДЫ (категории + строка настроек)
--
-- Приложение само досевает категории и settings при ПЕРВОМ входе (см.
-- useCategories/useSettings), поэтому ручной прогон ниже НЕ обязателен.
--
-- Если хотите засеять вручную через SQL Editor: SQL Editor выполняется как
-- сервисная роль, где auth.uid() = NULL, поэтому подставьте свой user UUID.
-- Свой UUID: Supabase → Authentication → Users → ваш пользователь → User UID.
-- Раскомментируйте блок и замените 'ВАШ-USER-UUID'.
-- ============================================================================

-- do $$
-- declare uid uuid := 'ВАШ-USER-UUID';
-- begin
--   insert into public.categories (user_id, type, name) values
--     (uid, 'expense', 'Реклама'),
--     (uid, 'expense', 'ИИ'),
--     (uid, 'expense', 'Сервисы и подписки'),
--     (uid, 'expense', 'Прочее'),
--     (uid, 'income',  'Веб'),
--     (uid, 'income',  'Боты'),
--     (uid, 'income',  'SEO');
--   insert into public.settings (user_id, tax_rate) values (uid, 6)
--     on conflict (user_id) do nothing;
-- end $$;
