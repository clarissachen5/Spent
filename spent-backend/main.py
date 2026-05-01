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


def infer_category(event_title: str, categories: list[str]) -> str:
    """Keyword-based fallback when the model omits or misspells the category."""
    title_lower = event_title.lower()
    keyword_map = {
        "Eating Out":     ["restaurant", "dinner", "lunch", "brunch", "eat", "food", "cafe", "bar", "pub", "pizza", "sushi", "burger", "taco"],
        "Groceries":      ["grocery", "groceries", "supermarket", "market", "whole foods", "trader joe", "costco"],
        "Coffee":         ["coffee", "latte", "starbucks", "dunkin", "boba", "tea", "espresso", "cafe"],
        "Transportation": ["uber", "lyft", "bus", "train", "subway", "flight", "airport", "commute", "drive", "car", "bike", "transit"],
        "Entertainment":  ["concert", "movie", "show", "game", "sport", "theater", "festival", "party", "club", "bar", "event", "ticket"],
        "Shopping":       ["shop", "mall", "store", "buy", "purchase", "amazon", "order", "sale", "outlet"],
    }
    for cat in categories:
        keywords = keyword_map.get(cat, [cat.lower()])
        if any(kw in title_lower for kw in keywords):
            return cat
    return categories[0]


@app.post("/ollama/analyze")
async def analyze_events(request: Request):
    try:
        data = await request.json()
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    events = data.get("events", {})
    categories = data.get("categories", [])
    if not categories:
        return JSONResponse(status_code=400, content={"error": "categories are required"})
    categories_str = ", ".join(categories)

    prompt = f"""Return ONLY a JSON object. No explanation, no markdown, no extra text.

Spending categories: {categories_str}

Calendar events: {json.dumps(events)}

For every event produce: date (YYYY-MM-DD), event (title string), category (pick one from the spending categories list, exact spelling), low (amount number + description string max 3 words), medium (amount + description), high (amount + description).

Output exactly this structure:
{{"estimates":[{{"date":"YYYY-MM-DD","event":"title","category":"category name","low":{{"amount":0,"description":"words"}},"medium":{{"amount":0,"description":"words"}},"high":{{"amount":0,"description":"words"}}}}]}}"""

    print("Calling Ollama with", len(events), "events, categories:", categories)
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
            parsed_json = json.loads(json_match.group(0))
            estimates = parsed_json.get("estimates", [])

            # Validate / repair category on every estimate
            valid_cats = set(categories)
            for est in estimates:
                cat = est.get("category", "")
                if cat not in valid_cats:
                    # Try case-insensitive match first
                    matched = next((c for c in categories if c.lower() == cat.lower()), None)
                    est["category"] = matched if matched else infer_category(est.get("event", ""), categories)

            parsed_estimates = json.dumps({"estimates": estimates})
    except Exception:
        parsed_estimates = None

    return JSONResponse(content={
        "id": str(uuid.uuid4()),
        "events_input": json.dumps(events),
        "raw_response": raw_response,
        "parsed_estimates": parsed_estimates,
        "created_at": str(__import__("datetime").datetime.utcnow()),
    })


@app.post("/ollama/spending-summary")
async def spending_summary(request: Request):
    try:
        data = await request.json()
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

    spending_by_category: dict = data.get("spending_by_category", {})
    total: float = data.get("total", 0)
    month: str = data.get("month", "this month")

    if not spending_by_category:
        return JSONResponse(status_code=400, content={"error": "No spending data provided"})

    breakdown_lines = "\n".join(
        f"  - {cat}: ${amt:.2f}" for cat, amt in spending_by_category.items()
    )
    prompt = f"""You are a friendly financial assistant helping a college student understand their spending for {month}.

Here is their spending breakdown:
{breakdown_lines}
Total: ${total:.2f}

Write a short, encouraging 2-3 sentence summary of their spending habits this month. Be specific about their top categories, note any patterns, and give one actionable tip. Keep it conversational and supportive. Do not use bullet points or lists — write in plain prose only."""

    try:
        result = ollama_client.generate(model="llama3.2:3b", prompt=prompt, options={"num_predict": 300})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": f"Ollama error: {str(e)}"})

    return JSONResponse(content={"summary": result.response})


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
