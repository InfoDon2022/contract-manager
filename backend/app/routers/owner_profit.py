from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.models import (
    Contract, OwnerProfitRecord, ClientInvoice, WeeklyEntry, DirectCost
)
from app.schemas import OwnerProfitCreate, OwnerProfitUpdate, OwnerProfitOut

router = APIRouter(prefix="/api/owner-profit", tags=["owner-profit"])


def _compute_derived(record: OwnerProfitRecord) -> None:
    """Recompute owner_profit, tax_set_aside, net_profit in place."""
    record.owner_profit = (
        record.gross_income
        - record.subcontractor_costs
        - record.direct_expenses
        - record.indirect_expenses
    )
    tax_rate = Decimal(str(record.tax_rate))
    record.tax_set_aside = record.owner_profit * tax_rate
    record.net_profit = record.owner_profit - record.tax_set_aside


def _line_cost(e: WeeklyEntry) -> Decimal:
    if e.entry_type == "hourly_labor" and e.hours is not None and e.hourly_rate is not None:
        return Decimal(str(e.hours)) * Decimal(str(e.hourly_rate))
    return Decimal(str(e.flat_amount)) if e.flat_amount is not None else Decimal("0")


@router.get("")
def list_owner_profit(
    contract_id: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(OwnerProfitRecord)
    if contract_id:
        q = q.filter(OwnerProfitRecord.contract_id == contract_id)
    rows = q.order_by(OwnerProfitRecord.month_year).all()
    return [OwnerProfitOut.model_validate(r) for r in rows]


@router.post("", response_model=OwnerProfitOut)
def create_or_update_owner_profit(data: OwnerProfitCreate, db: Session = Depends(get_db)):
    """Upserts — only one record per (contract_id, month_year)."""
    existing = (
        db.query(OwnerProfitRecord)
        .filter(
            OwnerProfitRecord.contract_id == data.contract_id,
            OwnerProfitRecord.month_year == data.month_year,
        )
        .first()
    )
    if existing:
        for k, v in data.model_dump().items():
            setattr(existing, k, v)
        _compute_derived(existing)
        db.commit()
        db.refresh(existing)
        return OwnerProfitOut.model_validate(existing)

    record = OwnerProfitRecord(**data.model_dump())
    _compute_derived(record)
    db.add(record)
    db.commit()
    db.refresh(record)
    return OwnerProfitOut.model_validate(record)


@router.put("/{record_id}", response_model=OwnerProfitOut)
def update_owner_profit(record_id: str, data: OwnerProfitUpdate, db: Session = Depends(get_db)):
    record = db.query(OwnerProfitRecord).filter(OwnerProfitRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    for k, v in data.model_dump().items():
        setattr(record, k, v)
    _compute_derived(record)
    db.commit()
    db.refresh(record)
    return OwnerProfitOut.model_validate(record)


@router.delete("/{record_id}", status_code=204)
def delete_owner_profit(record_id: str, db: Session = Depends(get_db)):
    record = db.query(OwnerProfitRecord).filter(OwnerProfitRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    db.delete(record)
    db.commit()


@router.get("/auto-compute")
def auto_compute(contract_id: str, month_year: str, db: Session = Depends(get_db)):
    """
    Reads existing data to pre-fill a profit record for the given month.
    Does NOT save — returns a preview.

    - gross_income: sum of client invoices with invoice_date in month_year
    - subcontractor_costs: sum of hourly_labor + flat_fee weekly entries in month_year
    - direct_expenses: sum of direct_cost + travel_stipend entries in month_year
      plus DirectCost table entries (status != planned) in month_year
    - indirect_expenses: 0 (fill manually — could later pull from MonthlyForecast overhead)
    """
    # Gross income from client invoices
    gross_income = (
        db.query(func.coalesce(func.sum(ClientInvoice.amount), 0))
        .filter(
            ClientInvoice.contract_id == contract_id,
            func.to_char(ClientInvoice.invoice_date, "YYYY-MM") == month_year,
        )
        .scalar()
    )

    # Weekly entries for the month
    month_entries = (
        db.query(WeeklyEntry)
        .filter(
            WeeklyEntry.contract_id == contract_id,
            func.to_char(WeeklyEntry.week_start, "YYYY-MM") == month_year,
        )
        .all()
    )

    sub_costs = sum(
        _line_cost(e)
        for e in month_entries
        if e.entry_type in ("hourly_labor", "flat_fee")
    )
    direct_from_weekly = sum(
        _line_cost(e)
        for e in month_entries
        if e.entry_type in ("direct_cost", "travel_stipend")
    )

    # Direct costs from the direct_costs table
    direct_from_table = (
        db.query(func.coalesce(func.sum(DirectCost.amount), 0))
        .filter(
            DirectCost.contract_id == contract_id,
            DirectCost.status != "planned",
            func.to_char(DirectCost.cost_date, "YYYY-MM") == month_year,
        )
        .scalar()
    )

    direct_expenses = direct_from_weekly + Decimal(str(direct_from_table))

    # Check if a record already exists
    existing = (
        db.query(OwnerProfitRecord)
        .filter(
            OwnerProfitRecord.contract_id == contract_id,
            OwnerProfitRecord.month_year == month_year,
        )
        .first()
    )

    record_id = existing.id if existing else None
    tax_rate = Decimal(str(existing.tax_rate)) if existing else Decimal("0.40")
    indirect = Decimal(str(existing.indirect_expenses)) if existing else Decimal("0")

    owner_profit = Decimal(str(gross_income)) - sub_costs - direct_expenses - indirect
    tax_set_aside = owner_profit * tax_rate
    net_profit = owner_profit - tax_set_aside

    return {
        "record_id": record_id,
        "contract_id": contract_id,
        "month_year": month_year,
        "gross_income": float(round(Decimal(str(gross_income)), 2)),
        "subcontractor_costs": float(round(sub_costs, 2)),
        "direct_expenses": float(round(direct_expenses, 2)),
        "indirect_expenses": float(round(indirect, 2)),
        "owner_profit": float(round(owner_profit, 2)),
        "tax_rate": float(tax_rate),
        "tax_set_aside": float(round(tax_set_aside, 2)),
        "net_profit": float(round(net_profit, 2)),
    }
