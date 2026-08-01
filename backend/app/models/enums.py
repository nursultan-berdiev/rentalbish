"""Перечисления доменной модели.

Наследуемся от StrEnum: значения членов — это строки-значения (напр. "admin").
В колонках БД используем values_callable (см. app.db.base.enum_type), чтобы
в базе хранились именно значения, а не имена членов.
"""

import enum


class UserRole(enum.StrEnum):
    ADMIN = "admin"  # администратор/владелец: всё + управление пользователями и справочниками
    STAFF = "staff"  # сотрудник склада: операции с товаром, брони, выдачи, возвраты


class ProductType(enum.StrEnum):
    ITEM = "item"  # обычный товар
    SET = "set"  # комплект/набор из нескольких товаров


class MessageRole(enum.StrEnum):
    USER = "user"  # реплика сотрудника
    ASSISTANT = "assistant"  # ответ ИИ


class BookingStatus(enum.StrEnum):
    NEW = "new"
    CONFIRMED = "confirmed"
    ISSUED = "issued"
    RETURNED = "returned"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class WebOrderStatus(enum.StrEnum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    CONVERTED = "converted"  # переведена в бронь
    REJECTED = "rejected"


class WriteOffReason(enum.StrEnum):
    BREAKAGE = "breakage"  # бой
    LOSS = "loss"  # утеря
    WEAR = "wear"  # износ


class ClientSource(enum.StrEnum):
    SITE = "site"  # заявка с сайта-витрины
    CALL = "call"  # звонок
    MESSENGER = "messenger"  # мессенджер
    OTHER = "other"
