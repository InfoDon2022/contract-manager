from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import BankAccount
from app.schemas import BankAccountCreate, BankAccountUpdate, BankAccountOut

router = APIRouter(prefix="/api/bank-accounts", tags=["bank_accounts"])


@router.get("", response_model=list[BankAccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return db.query(BankAccount).all()


@router.post("", response_model=BankAccountOut)
def create_account(data: BankAccountCreate, db: Session = Depends(get_db)):
    a = BankAccount(**data.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.put("/{acct_id}", response_model=BankAccountOut)
def update_account(acct_id: str, data: BankAccountUpdate, db: Session = Depends(get_db)):
    a = db.query(BankAccount).filter(BankAccount.id == acct_id).first()
    if not a:
        raise HTTPException(404, "Account not found")
    for k, v in data.model_dump().items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    return a
