from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ExpenseCreate(BaseModel):
    id: str
    amount: float
    category: str
    note: Optional[str] = None


class ExpenseOut(ExpenseCreate):
    created_at: datetime


class SpendingAnalysisOut(BaseModel):
    id: str
    events_input: str
    raw_response: str
    parsed_estimates: Optional[str] = None  # JSON string
class DetectedLocationCreate(BaseModel):
    id: str
    google_place_id: str
    place_name: str
    address: str
    category: str
    latitude: float
    longitude: float
    arrived_at: datetime


class DetectedLocationOut(DetectedLocationCreate):
    flashcard_shown: bool
    created_at: datetime
