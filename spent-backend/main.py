from fastapi import FastAPI, Depends, Request
from sqlalchemy.orm import Session
from db import get_db
from models import Expense
from schemas import ExpenseCreate, ExpenseOut
from ollama import Client

app = FastAPI()
ollama_client = Client()


@app.post("/ollama/analyze")
async def analyze_events(request: Request):
    data = await request.json()
    events = data.get("events")

    prompt = f"""
Estimate how much money someone might spend at these events:

{events}

Return a short JSON estimate.
"""

    result = ollama_client.generate(model="llama3.2:3b", prompt=prompt)

    return {"result": result["response"]}


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


@app.post("/ollama/analyze")
async def analyze_events(request: Request):
    data = await request.json()
    events = data.get("events", {})
    # Call Ollama Llama 3B API here
    result = ollama_client.generate(model="llama3", prompt=str(events))
    return {"result": result}
