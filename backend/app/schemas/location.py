"""Схемы точек/складов."""

from pydantic import BaseModel, ConfigDict, Field


class LocationBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    address: str = ""
    comment: str = ""
    is_active: bool = True


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = None
    comment: str | None = None
    is_active: bool | None = None


class LocationOut(LocationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
