# Dev-образ для Vite-фронтов (web-admin и web-site).
#
# Зависимости ставятся ВНУТРЬ образа, а исходники монтируются томом — поэтому в
# compose рядом с bind-моунтом кода стоит анонимный том на /app/node_modules:
# иначе монтирование каталога проекта затёрло бы установленные здесь пакеты.
FROM node:22-alpine

WORKDIR /app

# Сначала только манифесты — слой с зависимостями переиспользуется, пока они не менялись.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Порт и host берутся из vite.config.ts (host:true, port, hmr.clientPort=80).
CMD ["npx", "vite"]
