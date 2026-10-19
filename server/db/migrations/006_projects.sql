-- Смена профиля студии (19.10.2026): вместо продажи ИИ-автоматизации — редизайн
-- старых сайтов по пайплайну плагина webik. Главная сущность админки теперь —
-- проект редизайна; этапы те же, что в .webik/state.json плагина, плюс «прод».
-- Правила этапов — src/admin/lib/projects.ts.

create table projects (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users (id) on delete cascade,
  -- slug папки проекта и поддомена демо; по нему плагин находит проект
  slug                 text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  name                 text not null check (length(name) between 1 and 200),
  source_url           text,
  stage                text not null default 'audited' check (stage in ('audited','designing','built','demo','prod')),
  design_artifact_url  text,
  demo_url             text,
  prod_url             text,
  client_id            uuid references clients (id) on delete set null,
  contact_name         text,
  phone                text,
  email                text,
  telegram_username    text,
  amount               numeric(14,2) check (amount >= 0),
  next_step            text,
  next_step_date       date,
  note                 text,
  -- Проект закрыт без выкладки (клиент отказался) — уходит из рабочих списков
  closed               boolean not null default false,
  stage_changed_at     timestamptz not null default now(),
  -- Последнее обновление из плагина; null — проект заведён только вручную
  synced_at            timestamptz,
  created_at           timestamptz not null default now(),
  unique (user_id, slug)
);
create index projects_user_next_step_idx on projects (user_id, next_step_date);

-- Журнал проекта: смены этапа, обновления из плагина, звонки и заметки
create table project_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  project_id  uuid not null references projects (id) on delete cascade,
  type        text not null check (type in ('stage','sync','call','message','meeting','note')),
  date        date not null,
  comment     text,
  created_at  timestamptz not null default now()
);
create index project_events_project_idx on project_events (project_id, date);

-- Доход можно привязать к проекту: видно, сколько принёс каждый редизайн
alter table incomes add column project_id uuid references projects (id) on delete set null;

-- Токен плагина webik: плагин сообщает этапы в /api/webik/projects. В базе —
-- только SHA-256, сам токен показывается один раз при выпуске. Один на пользователя.
create table api_tokens (
  id            text primary key,
  user_id       uuid not null unique references users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

-- Старые лиды под ИИ-автоматизацию — в архив. Новые заявки с сайта приходят
-- с archived = false и ждут разбора на экране «Сегодня».
alter table leads add column archived boolean not null default false;
update leads set archived = true;
