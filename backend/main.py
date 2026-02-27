from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from db import get_db
from models import Expense
from schemas import ExpenseCreate, ExpenseOut

app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/expenses", response_model=list[ExpenseOut])
def list_expenses(db: Session = Depends(get_db)):
    return db.query(Expense).order_by(Expense.created_at.desc()).all()


@app.post("/expenses", response_model=ExpenseOut)
def create_expense(body: ExpenseCreate, db: Session = Depends(get_db)):
    expense = Expense(**body.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense
