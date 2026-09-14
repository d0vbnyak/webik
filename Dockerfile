# WebIK: сайт (статика) + API админки в одном контейнере.
#
# Сборка сайта и сервера делается ЗАРАНЕЕ, на машине разработчика
# (npm run build && npm run build:server) — на общем прод-сервере не тратим
# гигабайт памяти на Vite рядом с чужими сервисами. Сюда попадают готовые
# dist/ и build/ и только прод-зависимости.

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# Скрипты установки пакетов не запускаем: рантайму они не нужны
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY dist ./dist
COPY build ./build
COPY server/db/migrations ./build/migrations
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "build/main.mjs"]
