from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from db import get_db
from models import Expense, DetectedLocation
from schemas import ExpenseCreate, ExpenseOut, DetectedLocationCreate, DetectedLocationOut

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


@app.post("/detected-locations", response_model=DetectedLocationOut)
def create_detected_location(body: DetectedLocationCreate, db: Session = Depends(get_db)):
    loc = DetectedLocation(**body.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


@app.get("/detected-locations/pending", response_model=list[DetectedLocationOut])
def get_pending_locations(db: Session = Depends(get_db)):
    return (
        db.query(DetectedLocation)
        .filter(DetectedLocation.flashcard_shown == False)
        .order_by(DetectedLocation.created_at.asc())
        .all()
    )


@app.patch("/detected-locations/{location_id}/shown", response_model=DetectedLocationOut)
def mark_location_shown(location_id: str, db: Session = Depends(get_db)):
    loc = db.query(DetectedLocation).filter(DetectedLocation.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    loc.flashcard_shown = True
    db.commit()
    db.refresh(loc)
    return loc
