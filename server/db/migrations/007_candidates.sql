-- Кандидаты на редизайн (20.10.2026): действующие фирмы с устаревшими сайтами,
-- найденные холодным поиском. Им ещё не писали; после согласия кандидат
-- превращается в проект (project_id). Правила — src/admin/lib/candidates.ts.

create table candidates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  name          text not null check (length(name) between 1 and 200),
  site_url      text not null check (site_url ~ '^https?://'),
  -- Домен без www — по нему импорт отсекает дубли
  domain        text not null check (domain ~ '^[a-z0-9.-]+$'),
  city          text,
  niche         text,
  phone         text,
  email         text,
  -- Что не так с сайтом: по пунктам, через перевод строки
  problems      text,
  -- Балл устарелости из отбора: чем выше, тем хуже сайт
  score         int check (score between 0 and 100),
  status        text not null default 'new' check (status in ('new','contacted','declined','converted')),
  contacted_at  date,
  note          text,
  project_id    uuid references projects (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (user_id, domain)
);
create index candidates_user_status_idx on candidates (user_id, status);
