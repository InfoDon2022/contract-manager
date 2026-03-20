from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.models import VendorBill, VendorPayment, BillStatus
from app.schemas import (
    VendorBillCreate, VendorBillUpdate, VendorBillOut,
    VendorPaymentCreate, VendorPaymentOut,
)

router = APIRouter(prefix="/api/vendor-bills", tags=["vendor_bills"])


@router.get("", response_model=list[VendorBillOut])
def list_bills(
    contract_id: str | None = None,
    vendor_id: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(VendorBill)
    if contract_id:
        q = q.filter(VendorBill.contract_id == contract_id)
    if vendor_id:
        q = q.filter(VendorBill.vendor_id == vendor_id)
    return q.order_by(VendorBill.bill_date.desc()).all()


@router.post("", response_model=VendorBillOut)
def create_bill(data: VendorBillCreate, db: Session = Depends(get_db)):
    bill = VendorBill(**data.model_dump())
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill


@router.put("/{bill_id}", response_model=VendorBillOut)
def update_bill(bill_id: str, data: VendorBillUpdate, db: Session = Depends(get_db)):
    bill = db.query(VendorBill).filter(VendorBill.id == bill_id).first()
    if not bill:
        raise HTTPException(404, "Bill not found")
    for k, v in data.model_dump().items():
        setattr(bill, k, v)
    db.commit()
    db.refresh(bill)
    return bill


@router.delete("/{bill_id}")
def delete_bill(bill_id: str, db: Session = Depends(get_db)):
    bill = db.query(VendorBill).filter(VendorBill.id == bill_id).first()
    if not bill:
        raise HTTPException(404, "Bill not found")
    db.query(VendorPayment).filter(VendorPayment.vendor_bill_id == bill_id).delete()
    db.delete(bill)
    db.commit()
    return {"ok": True}


# ── Payments ──

@router.get("/{bill_id}/payments", response_model=list[VendorPaymentOut])
def list_payments(bill_id: str, db: Session = Depends(get_db)):
    return db.query(VendorPayment).filter(VendorPayment.vendor_bill_id == bill_id).all()


@router.post("/{bill_id}/payments", response_model=VendorPaymentOut)
def create_payment(bill_id: str, data: VendorPaymentCreate, db: Session = Depends(get_db)):
    bill = db.query(VendorBill).filter(VendorBill.id == bill_id).first()
    if not bill:
        raise HTTPException(404, "Bill not found")

    pay = VendorPayment(**data.model_dump())
    db.add(pay)
    db.flush()

    # Auto-update bill status
    total_paid = (
        db.query(func.coalesce(func.sum(VendorPayment.amount), 0))
        .filter(VendorPayment.vendor_bill_id == bill_id)
        .scalar()
    )
    if total_paid >= bill.amount:
        bill.status = BillStatus.paid
    elif total_paid > 0:
        bill.status = BillStatus.partially_paid

    db.commit()
    db.refresh(pay)
    return pay
