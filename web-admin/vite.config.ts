import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Админку отдаём под суб-путём /admin — единый домен вместе с витриной (/) и
// API (/api) за reverse-proxy Caddy. base влияет и на dev-сервер: ассеты и
// HMR уезжают под /admin/, поэтому в main.tsx у BrowserRouter стоит basename.
export default defineConfig({
  base: "/admin/",
  plugins: [react()],
  server: {
    port: 5173,
    // Слушать 0.0.0.0: иначе dev-сервер недоступен из Windows-браузера (WSL2)
    // и с телефона (нужно для заведения товара с камеры).
    host: true,
    // Dev-стенд открывают по разным именам (localhost, IP, home-server-wsl),
    // а Vite по умолчанию пускает только известные ему хосты.
    allowedHosts: true,
    // Страница открыта через Caddy на :80, а не напрямую на :5173 — сообщаем
    // HMR-клиенту правильный порт, иначе live-reload не подключится.
    hmr: { clientPort: 80 },
  },
});
