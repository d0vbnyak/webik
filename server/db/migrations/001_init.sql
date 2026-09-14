-- WebIK · админка: схема на своём Postgres (переезд с Supabase, 14.09.2026).
-- Изоляцию данных, которую раньше давал RLS, теперь обеспечивает API:
-- каждый запрос фильтруется по user_id из сессии (server/api/query.ts).

create table users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null unique,
  password_hash  text not null,
  created_at     timestamptz not null default now()
);

-- Сессии входа. В базе — только SHA-256 от токена: утечка дампа не даёт войти.
create table sessions (
  id          text primary key,
  user_id     uuid not null references users (id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index sessions_user_idx on sessions (user_id);

create table clients (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users (id) on delete cascade,
  name               text not null,
  phone              text,
  telegram_username  text,
  max_link           text,
  created_at         timestamptz not null default now()
);

create table recurring_expenses (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users (id) on delete cascade,
  name                  text not null,
  amount                numeric(14,2) not null check (amount >= 0),
  category              text not null,
  next_charge_date      date not null,
  reminder_days_before  int not null default 3 check (reminder_days_before >= 0),
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

create table expenses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  amount        numeric(14,2) not null check (amount >= 0),
  date          date not null,
  category      text not null,
  comment       text,
  recurring_id  uuid references recurring_expenses (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table incomes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users (id) on delete cascade,
  amount          numeric(14,2) not null check (amount >= 0),
  date            date not null,
  category        text not null,
  client_id       uuid references clients (id) on delete set null,
  payment_status  text not null default 'unpaid' check (payment_status in ('paid','unpaid','partial')),
  paid_amount     numeric(14,2) not null default 0 check (paid_amount >= 0),
  due_date        date,
  comment         text,
  created_at      timestamptz not null default now()
);

create table categories (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references users (id) on delete cascade,
  type     text not null check (type in ('expense','income')),
  name     text not null,
  unique (user_id, type, name)
);

create table goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id) on delete cascade,
  year           int not null,
  month          int not null check (month between 1 and 12),
  target_amount  numeric(14,2) not null check (target_amount >= 0),
  unique (user_id, year, month)
);

create table settings (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users (id) on delete cascade,
  tax_rate             numeric(5,2) not null default 6,
  default_monthly_goal numeric(14,2),
  unique (user_id)
);

-- CRM. Этапы и коды отказов — src/admin/lib/crm.ts, там же правила переходов.
create table leads (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users (id) on delete cascade,
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
  client_id         uuid references clients (id) on delete set null,
  stage_changed_at  timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create table lead_touches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  lead_id     uuid not null references leads (id) on delete cascade,
  type        text not null check (type in ('email','followup','call','meeting','message','proposal','note','stage')),
  date        date not null,
  comment     text,
  created_at  timestamptz not null default now()
);

create index expenses_user_date_idx    on expenses (user_id, date);
create index incomes_user_date_idx     on incomes (user_id, date);
create index incomes_status_idx        on incomes (user_id, payment_status);
create index expenses_recurring_idx    on expenses (recurring_id);
create index recurring_user_active_idx on recurring_expenses (user_id, active);
create index leads_user_next_step_idx  on leads (user_id, next_step_date);
create index lead_touches_lead_idx     on lead_touches (lead_id, date);
