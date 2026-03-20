from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Contract
from app.schemas import ContractCreate, ContractUpdate, ContractOut

router = APIRouter(prefix="/api/contracts", tags=["contracts"])


@router.get("", response_model=list[ContractOut])
def list_contracts(db: Session = Depends(get_db)):
    return db.query(Contract).all()


@router.get("/{contract_id}", response_model=ContractOut)
def get_contract(contract_id: str, db: Session = Depends(get_db)):
    c = db.query(Contract).filter(Contract.id == contract_id).first()
    if not c:
        raise HTTPException(404, "Contract not found")
    return c


@router.post("", response_model=ContractOut)
def create_contract(data: ContractCreate, db: Session = Depends(get_db)):
    c = Contract(**data.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.put("/{contract_id}", response_model=ContractOut)
def update_contract(contract_id: str, data: ContractUpdate, db: Session = Depends(get_db)):
    c = db.query(Contract).filter(Contract.id == contract_id).first()
    if not c:
        raise HTTPException(404, "Contract not found")
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c
