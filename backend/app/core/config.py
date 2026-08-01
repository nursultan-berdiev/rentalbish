"""Конфигурация приложения. Все значения читаются из окружения (.env)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Общие ---
    PROJECT_NAME: str = "Rentalbish API"
    ENV: str = "dev"  # dev | prod
    API_V1_PREFIX: str = "/api/v1"

    # --- Безопасность / JWT ---
    SECRET_KEY: str = "change-me-in-env"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 часов
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    JWT_ALGORITHM: str = "HS256"

    # --- База данных ---
    # Прямой URL (напр. sqlite для тестов). Если пусто — собирается из POSTGRES_*.
    DATABASE_URL: str = ""
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "rental"
    POSTGRES_PASSWORD: str = "rental"
    POSTGRES_DB: str = "rental"

    # --- Redis / Celery ---
    REDIS_URL: str = "redis://redis:6379/0"
    # Синхронный прогон задач без брокера (тесты). В dev/prod — False.
    CELERY_ALWAYS_EAGER: bool = False

    # --- CORS (адреса фронтендов) ---
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",  # web-admin (Vite dev)
        "http://localhost:5174",  # web-site (Vite dev)
    ]
    # Регулярка разрешённых Origin. Если пусто и ENV=dev — подставляется
    # DEV_CORS_ORIGIN_REGEX (любой хост на портах фронтов: панель открывают и по
    # localhost, и по имени хоста, и с телефона по IP). В prod задавать явно.
    CORS_ORIGIN_REGEX: str = ""

    # --- Медиа (фото товаров) ---
    MEDIA_ROOT: str = "media"
    MEDIA_URL: str = "/media"

    # --- Внешние интеграции ---
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-opus-4-8"
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    # --- ИИ-ассистент: провайдер ---
    # gateway → ходим в claude-gateway (подписка, ключ не нужен); api → напрямую
    # в Anthropic SDK (нужен ANTHROPIC_API_KEY, но зато с инструментами).
    AI_BACKEND: str = "gateway"  # gateway | api
    CLAUDE_GATEWAY_URL: str = "http://claude_gw_api:8080"
    CLAUDE_GATEWAY_API_KEY: str = ""
    CLAUDE_GATEWAY_MODEL: str = "sonnet"
    CLAUDE_GATEWAY_TIMEOUT: int = 240
    # Инструменты на gateway-пути — через наш MCP-сервер. URL, по которому воркер
    # шлюза (сеть claude_net) достучится до MCP rentalbish. Пусто → чистый чат.
    AI_TOOLS_VIA_MCP: bool = True
    MCP_SELF_URL: str = "http://rentalbish_mcp:9000/mcp"

    # --- Первичный администратор (сид) ---
    FIRST_ADMIN_LOGIN: str = "admin"
    FIRST_ADMIN_PASSWORD: str = "admin"

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
