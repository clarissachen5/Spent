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
