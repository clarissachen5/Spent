import json
import re
import uuid
import traceback
from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from db import get_db
from models import Expense, SpendingAnalysis
from schemas import ExpenseCreate, ExpenseOut, SpendingAnalysisOut
from ollama import Client
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from db import get_db
from models import Expense, DetectedLocation
from schemas import ExpenseCreate, ExpenseOut, DetectedLocationCreate, DetectedLocationOut

app = FastAPI()
ollama_client = Client()


@app.post("/ollama/analyze")
async def analyze_events(request: Request):
    try:
        data = await request.json()
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    events = data.get("events", {})

    prompt = f"""Given these events {json.dumps(events, indent=2)} estimate how much this college student would spend at each event. Give me back three different amounts low, medium, high. With each spend amount give me a max three word description of what they buy.

Return ONLY a JSON object with this structure, no explanation:
{{
  "estimates": [
    {{
      "date": "YYYY-MM-DD",
      "event": "event title",
      "low": {{ "amount": 0.00, "description": "three word description" }},
      "medium": {{ "amount": 0.00, "description": "three word description" }},
      "high": {{ "amount": 0.00, "description": "three word description" }}
    }}
  ]
}}
"""

    print("Calling Ollama with", len(events), "events...")
    try:
        result = ollama_client.generate(model="llama3.2:3b", prompt=prompt, options={"num_predict": 8192})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": f"Ollama error: {str(e)}"})
    raw_response = result.response

    print("Ollama output:", raw_response)

    parsed_estimates = None
    try:
        json_match = re.search(r"\{[\s\S]*\}", raw_response)
        if json_match:
            parsed_estimates = json_match.group(0)
            json.loads(parsed_estimates)  # validate it parses
    except Exception:
        parsed_estimates = None

    return JSONResponse(content={
        "id": str(uuid.uuid4()),
        "events_input": json.dumps(events),
        "raw_response": raw_response,
        "parsed_estimates": parsed_estimates,
        "created_at": str(__import__("datetime").datetime.utcnow()),
    })


@app.get("/ollama/analyses", response_model=list[SpendingAnalysisOut])
def list_analyses(db: Session = Depends(get_db)):
    return db.query(SpendingAnalysis).order_by(SpendingAnalysis.created_at.desc()).all()


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
