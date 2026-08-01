"""Доменные исключения сервисного слоя.

Роутеры перехватывают DomainError и превращают в HTTP-ответ (обычно 400/409).
"""


class DomainError(Exception):
    """Базовая ошибка бизнес-логики (нарушение правил, а не сбой инфраструктуры)."""

    status_code = 400

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class NotFoundError(DomainError):
    status_code = 404


class ConflictError(DomainError):
    """Конфликт состояния: нехватка остатка, недопустимый переход статуса и т.п."""

    status_code = 409
