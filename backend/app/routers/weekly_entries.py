from collections import defaultdict
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import ClientInvoice, Contract, WeeklyEntry
from app.schemas import WeeklyEntryCreate, WeeklyEntryUpdate, WeeklyEntryOut

router = APIRouter(prefix="/api/weekly-entries", tags=["weekly-entries"])

BILLING_RATE = Decimal("145")


def _line_cost(e: WeeklyEntry) -> Decimal:
    """Compute the dollar cost of a single entry."""
    if e.entry_type == "hourly_labor" and e.hours is not None and e.hourly_rate is not None:
        return Decimal(str(e.hours)) * Decimal(str(e.hourly_rate))
    return Decimal(str(e.flat_amount)) if e.flat_amount is not None else Decimal("0")


def _compute_summary(contract_id: str, db: Session):
    """
    Core financial engine. Returns:
      - weeks list (sorted by week_number)
      - total_ops across all weeks
      - owner_draw = contract.total_value - total_ops
    Week convention: the entire week is attributed to the month of week_start.
    """
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    entries = (
        db.query(WeeklyEntry)
        .filter(WeeklyEntry.contract_id == contract_id)
        .order_by(WeeklyEntry.week_number, WeeklyEntry.created_at)
        .all()
    )

    total_ops = sum(_line_cost(e) for e in entries)
    owner_draw = Decimal(str(contract.total_value)) - total_ops

    # Group by week_number
    week_map: dict[int, list[WeeklyEntry]] = defaultdict(list)
    for e in entries:
        week_map[e.week_number].append(e)

    weeks = []
    for wn in sorted(week_map.keys()):
        we = week_map[wn]
        week_ops = sum(_line_cost(e) for e in we)
        # Proportional margin allocation — reflects ALL entries to date
        if total_ops > 0:
            week_margin = (week_ops / total_ops) * owner_draw
        else:
            week_margin = Decimal("0")
        week_billable = week_ops + week_margin
        weeks.append({
            "week_number": wn,
            "week_start": min(e.week_start for e in we).isoformat(),
            "week_end": max(e.week_end for e in we).isoformat(),
            "ops_cost": float(round(week_ops, 2)),
            "allocated_margin": float(round(week_margin, 2)),
            "billable": float(round(week_billable, 2)),
            "entries": [WeeklyEntryOut.model_validate(e).model_dump() for e in we],
        })

    return weeks, total_ops, owner_draw


# ── CRUD ──

@router.get("")
def list_weekly_entries(
    contract_id: str | None = None,
    week_number: int | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(WeeklyEntry)
    if contract_id:
        q = q.filter(WeeklyEntry.contract_id == contract_id)
    if week_number is not None:
        q = q.filter(WeeklyEntry.week_number == week_number)
    entries = q.order_by(WeeklyEntry.week_number, WeeklyEntry.created_at).all()
    return [WeeklyEntryOut.model_validate(e).model_dump() for e in entries]


@router.post("", response_model=WeeklyEntryOut)
def create_weekly_entry(data: WeeklyEntryCreate, db: Session = Depends(get_db)):
    entry = WeeklyEntry(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return WeeklyEntryOut.model_validate(entry)


@router.put("/{entry_id}", response_model=WeeklyEntryOut)
def update_weekly_entry(entry_id: str, data: WeeklyEntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(WeeklyEntry).filter(WeeklyEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    for k, v in data.model_dump().items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return WeeklyEntryOut.model_validate(entry)


@router.delete("/{entry_id}", status_code=204)
def delete_weekly_entry(entry_id: str, db: Session = Depends(get_db)):
    entry = db.query(WeeklyEntry).filter(WeeklyEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()


# ── Financial summary (all weeks) ──

@router.get("/summary")
def weekly_summary(contract_id: str, db: Session = Depends(get_db)):
    """
    Returns per-week ops cost, allocated margin, and billable amount.
    Margins reflect ALL entries to date — they shift as new entries are added.
    """
    weeks, total_ops, owner_draw = _compute_summary(contract_id, db)
    contract = db.query(Contract).filter(Contract.id == contract_id).first()

    # Total actually invoiced to the client to date (for earned-margin display)
    total_billed = float(
        db.query(func.coalesce(func.sum(ClientInvoice.amount), 0))
        .filter(ClientInvoice.contract_id == contract_id)
        .scalar()
    )
    actual_margin = round(total_billed - float(total_ops), 2)

    return {
        "contract_value": float(contract.total_value),
        "total_ops": float(round(total_ops, 2)),
        "owner_draw": float(round(owner_draw, 2)),   # kept for billing engine reference
        "total_billed": total_billed,
        "actual_margin": actual_margin,              # billed − ops = what owner keeps
        "weeks": weeks,
    }


# ── Monthly billing summary ──

@router.get("/monthly-billing")
def monthly_billing(contract_id: str, db: Session = Depends(get_db)):
    """
    Aggregates weekly billable amounts by month (keyed to week_start month).
    Returns per-month: ops_cost, allocated_margin, billable, hours_at_145,
    and a breakdown by task_code.
    """
    weeks, total_ops, owner_draw = _compute_summary(contract_id, db)

    month_map: dict[str, dict] = {}
    for w in weeks:
        month = w["week_start"][:7]  # "YYYY-MM"
        if month not in month_map:
            month_map[month] = {
                "month_year": month,
                "ops_cost": 0.0,
                "allocated_margin": 0.0,
                "billable": 0.0,
                "hours_at_145": 0.0,
                "by_task": {},
            }
        m = month_map[month]
        m["ops_cost"] = round(m["ops_cost"] + w["ops_cost"], 2)
        m["allocated_margin"] = round(m["allocated_margin"] + w["allocated_margin"], 2)
        m["billable"] = round(m["billable"] + w["billable"], 2)
        m["hours_at_145"] = round(m["billable"] / float(BILLING_RATE), 4)

        # Task breakdown: each entry's proportion of the week's ops → proportion of week's billable
        week_ops = w["ops_cost"]
        for entry in w["entries"]:
            tc = entry["task_code"]
            entry_cost = entry["line_cost"]
            if week_ops > 0:
                entry_billable = (entry_cost / week_ops) * w["billable"]
            else:
                entry_billable = 0.0
            m["by_task"][tc] = round(m["by_task"].get(tc, 0.0) + entry_billable, 2)

    result = sorted(month_map.values(), key=lambda x: x["month_year"])
    # Recompute hours after final billable is set
    for m in result:
        m["hours_at_145"] = round(m["billable"] / float(BILLING_RATE), 4)
    return result
