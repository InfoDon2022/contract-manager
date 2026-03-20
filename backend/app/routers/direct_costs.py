from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import DirectCost
from app.schemas import DirectCostCreate, DirectCostUpdate, DirectCostOut

router = APIRouter(prefix="/api/direct-costs", tags=["direct_costs"])


@router.get("", response_model=list[DirectCostOut])
def list_costs(contract_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(DirectCost)
    if contract_id:
        q = q.filter(DirectCost.contract_id == contract_id)
    return q.order_by(DirectCost.cost_date.desc()).all()


@router.post("", response_model=DirectCostOut)
def create_cost(data: DirectCostCreate, db: Session = Depends(get_db)):
    c = DirectCost(**data.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.put("/{cost_id}", response_model=DirectCostOut)
def update_cost(cost_id: str, data: DirectCostUpdate, db: Session = Depends(get_db)):
    c = db.query(DirectCost).filter(DirectCost.id == cost_id).first()
    if not c:
        raise HTTPException(404, "Cost not found")
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{cost_id}")
def delete_cost(cost_id: str, db: Session = Depends(get_db)):
    c = db.query(DirectCost).filter(DirectCost.id == cost_id).first()
    if not c:
        raise HTTPException(404, "Cost not found")
    db.delete(c)
    db.commit()
    return {"ok": True}
