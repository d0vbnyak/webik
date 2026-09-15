#!/usr/bin/env bash
# Выкладка WebIK на сервер. Запускать из папки WebIK в Git Bash:
#   bash deploy/deploy.sh
#
# Что делает:
#   1. Собирает сайт и сервер у вас на машине и проверяет, что ключ не утёк в сборку.
#   2. Отправляет на сервер только нужное: compose, init-скрипт БД, Dockerfile,
#      dist/, build/, миграции, package*.json.
#   3. При первом запуске создаёт на сервере /opt/webik/.env со случайными паролями
#      базы (openssl, права 600). Пароли не печатаются и не покидают сервер.
#   4. Пересобирает и перезапускает контейнеры WebIK. Контейнеры второго бизнеса
#      не трогаются.
#
# Caddy и домен здесь НЕ настраиваются — см. deploy/README.md.
set -euo pipefail

SERVER="${WEBIK_SERVER:-root@72.56.237.147}"
REMOTE_DIR=/opt/webik

cd "$(dirname "$0")/.."
export PATH="$PATH:/c/Program Files/nodejs"

echo "== сборка"
npm run build
npm run build:server
if grep -rq "sk-ant" dist build; then
  echo "СТОП: в сборке найден ключ Anthropic" >&2
  exit 1
fi
if grep -rqE "[0-9]{8,10}:[A-Za-z0-9_-]{35}" dist build; then
  echo "СТОП: в сборке похоже на токен Telegram-бота" >&2
  exit 1
fi

echo "== упаковка"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/app/server/db"
cp deploy/docker-compose.yml "$STAGE/"
cp -r deploy/db-init "$STAGE/"
cp Dockerfile .dockerignore package.json package-lock.json "$STAGE/app/"
cp -r dist build "$STAGE/app/"
cp -r server/db/migrations "$STAGE/app/server/db/"
tar -C "$STAGE" -czf "$STAGE.tgz" .

echo "== отправка на $SERVER"
ssh -o BatchMode=yes "$SERVER" "mkdir -p $REMOTE_DIR && chmod 700 $REMOTE_DIR"
scp -q "$STAGE.tgz" "$SERVER:$REMOTE_DIR/release.tgz"
rm -f "$STAGE.tgz"

ssh -o BatchMode=yes "$SERVER" bash -s <<REMOTE
set -euo pipefail
cd $REMOTE_DIR
rm -rf app db-init
tar -xzf release.tgz && rm release.tgz
chmod +x db-init/*.sh

if [ ! -f .env ]; then
  umask 077
  {
    echo "POSTGRES_PASSWORD=\$(openssl rand -hex 32)"
    echo "APP_DB_PASSWORD=\$(openssl rand -hex 32)"
  } > .env
  echo "Создан .env со случайными паролями базы"
fi
chmod 600 .env

# Общая с Caddy сеть живёт вне compose-проектов (см. deploy/README.md)
docker network inspect webik_edge >/dev/null 2>&1 || docker network create --internal webik_edge
docker compose up -d --build --remove-orphans
docker image prune -f --filter "label=com.docker.compose.project=webik" >/dev/null || true

echo "== ждём готовности"
for i in \$(seq 1 30); do
  status=\$(docker inspect -f '{{.State.Health.Status}}' webik-app-1 2>/dev/null || echo starting)
  [ "\$status" = healthy ] && break
  sleep 2
done
docker compose ps
[ "\$status" = healthy ] || { docker compose logs --tail=50 app; exit 1; }
REMOTE

echo "Готово."
