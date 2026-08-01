# Прод-образ веб-входа: собирает обе SPA в статику и раздаёт их Caddy'ем, он же
# проксирует /api и /media на backend. Один контейнер — один порт наружу.
# Контекст сборки — корень репозитория (нужны web-admin, web-site, deploy).
#
# API дергается относительным путём /api/v1 (тот же origin, что и сайт) —
# поэтому CORS не задействуется и адрес/домен фронту знать не нужно.

# 1) Админка: base=/admin/ (из vite.config), API — относительный /api/v1.
FROM node:22-alpine AS build-admin
WORKDIR /app
COPY web-admin/package.json web-admin/package-lock.json ./
RUN npm ci
COPY web-admin/ ./
ENV VITE_API_URL=/api/v1
RUN npm run build

# 2) Витрина.
FROM node:22-alpine AS build-site
WORKDIR /app
COPY web-site/package.json web-site/package-lock.json ./
RUN npm ci
COPY web-site/ ./
ENV VITE_API_URL=/api/v1
RUN npm run build

# 3) Caddy со статикой обоих фронтов.
FROM caddy:2-alpine
COPY --from=build-admin /app/dist /srv/admin
COPY --from=build-site /app/dist /srv/site
COPY deploy/Caddyfile.prod /etc/caddy/Caddyfile
