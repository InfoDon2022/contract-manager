from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.models import ClientInvoice, ClientPayment, InvoiceStatus
from app.schemas import (
    ClientInvoiceCreate, ClientInvoiceUpdate, ClientInvoiceOut,
    ClientPaymentCreate, ClientPaymentOut,
)

router = APIRouter(prefix="/api/client-invoices", tags=["client_invoices"])


@router.get("", response_model=list[ClientInvoiceOut])
def list_invoices(contract_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(ClientInvoice)
    if contract_id:
        q = q.filter(ClientInvoice.contract_id == contract_id)
    return q.order_by(ClientInvoice.invoice_date.desc()).all()


@router.post("", response_model=ClientInvoiceOut)
def create_invoice(data: ClientInvoiceCreate, db: Session = Depends(get_db)):
    inv = ClientInvoice(**data.model_dump())
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


@router.put("/{inv_id}", response_model=ClientInvoiceOut)
def update_invoice(inv_id: str, data: ClientInvoiceUpdate, db: Session = Depends(get_db)):
    inv = db.query(ClientInvoice).filter(ClientInvoice.id == inv_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    for k, v in data.model_dump().items():
        setattr(inv, k, v)
    db.commit()
    db.refresh(inv)
    return inv


@router.delete("/{inv_id}")
def delete_invoice(inv_id: str, db: Session = Depends(get_db)):
    inv = db.query(ClientInvoice).filter(ClientInvoice.id == inv_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    # Delete associated payments first
    db.query(ClientPayment).filter(ClientPayment.client_invoice_id == inv_id).delete()
    db.delete(inv)
    db.commit()
    return {"ok": True}


# ── Payments ──

@router.get("/{inv_id}/payments", response_model=list[ClientPaymentOut])
def list_payments(inv_id: str, db: Session = Depends(get_db)):
    return db.query(ClientPayment).filter(ClientPayment.client_invoice_id == inv_id).all()


@router.post("/{inv_id}/payments", response_model=ClientPaymentOut)
def create_payment(inv_id: str, data: ClientPaymentCreate, db: Session = Depends(get_db)):
    inv = db.query(ClientInvoice).filter(ClientInvoice.id == inv_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")

    pay = ClientPayment(**data.model_dump())
    db.add(pay)
    db.flush()

    # Auto-update invoice status
    total_paid = (
        db.query(func.coalesce(func.sum(ClientPayment.amount), 0))
        .filter(ClientPayment.client_invoice_id == inv_id)
        .scalar()
    )
    if total_paid >= inv.amount:
        inv.status = InvoiceStatus.paid
    elif total_paid > 0:
        inv.status = InvoiceStatus.partially_paid

    db.commit()
    db.refresh(pay)
    return pay
