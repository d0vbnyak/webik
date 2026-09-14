#!/bin/sh
# Выполняется один раз, при первом старте пустого тома Postgres.
# Приложение работает не под суперпользователем: у роли webik_app есть права
# только на свою схему webik. Суперпользователь (POSTGRES_USER) — только для
# обслуживания и бэкапов.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$APP_DB_PASSWORD" <<'SQL'
create role webik_app login password :'app_password';
create schema webik authorization webik_app;
alter role webik_app set search_path = webik;
revoke all on schema public from public;
revoke all on database webik from public;
grant connect on database webik to webik_app;
SQL
