from sqlalchemy import String, Float, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional
from db import Base


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class DetectedLocation(Base):
    __tablename__ = "detected_locations"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    google_place_id: Mapped[str] = mapped_column(String, nullable=False)
    place_name: Mapped[str] = mapped_column(String, nullable=False)
    address: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    arrived_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    flashcard_shown: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
