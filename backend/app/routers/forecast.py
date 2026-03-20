from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import MonthlyForecast
from app.schemas import ForecastCreate, ForecastUpdate, ForecastOut

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


@router.get("", response_model=list[ForecastOut])
def list_forecast(contract_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(MonthlyForecast)
    if contract_id:
        q = q.filter(MonthlyForecast.contract_id == contract_id)
    return q.order_by(MonthlyForecast.month.asc()).all()


@router.post("", response_model=ForecastOut)
def create_forecast(data: ForecastCreate, db: Session = Depends(get_db)):
    f = MonthlyForecast(**data.model_dump())
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


@router.put("/{fc_id}", response_model=ForecastOut)
def update_forecast(fc_id: str, data: ForecastUpdate, db: Session = Depends(get_db)):
    f = db.query(MonthlyForecast).filter(MonthlyForecast.id == fc_id).first()
    if not f:
        raise HTTPException(404, "Forecast entry not found")
    for k, v in data.model_dump().items():
        setattr(f, k, v)
    db.commit()
    db.refresh(f)
    return f


@router.delete("/{fc_id}")
def delete_forecast(fc_id: str, db: Session = Depends(get_db)):
    f = db.query(MonthlyForecast).filter(MonthlyForecast.id == fc_id).first()
    if not f:
        raise HTTPException(404, "Forecast entry not found")
    db.delete(f)
    db.commit()
    return {"ok": True}
