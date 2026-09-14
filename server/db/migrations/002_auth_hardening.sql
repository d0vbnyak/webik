-- Усиление входа по итогам аудита безопасности (14.09.2026).

-- Сессии: срок простоя. Сессия, которой не пользовались дольше порога, не действует.
alter table sessions add column last_seen_at timestamptz not null default now();

-- Двухфакторный вход (TOTP, как в Google Authenticator). Секрет — base32.
-- totp_last_step — номер последнего принятого 30-секундного окна: один код
-- нельзя использовать дважды.
alter table users add column totp_secret text;
alter table users add column totp_last_step bigint;

-- Доверенные устройства: браузер, из которого уже был успешный вход. Для него
-- не действует блокировка по email — иначе любой мог бы запереть админа,
-- набрав 5 неверных паролей к его адресу. В базе — только SHA-256 токена.
create table trusted_devices (
  id          text primary key,
  user_id     uuid not null references users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
create index trusted_devices_user_idx on trusted_devices (user_id);

-- Журнал входов: когда, откуда, чем кончилось. Пароли и коды сюда не пишутся.
create table login_events (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  ip          text not null,
  email       text not null,
  outcome     text not null check (outcome in ('ok','bad_password','bad_totp','need_totp','rate_limited','busy'))
);
create index login_events_at_idx on login_events (at);
