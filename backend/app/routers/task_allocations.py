from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import SubcontractorTaskAllocation, Vendor
from app.schemas import TaskAllocationCreate, TaskAllocationUpdate, TaskAllocationOut

router = APIRouter(prefix="/api/task-allocations", tags=["task-allocations"])


@router.get("")
def list_task_allocations(
    contract_id: str | None = None,
    vendor_id: str | None = None,
    month_year: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(SubcontractorTaskAllocation)
    if contract_id:
        q = q.filter(SubcontractorTaskAllocation.contract_id == contract_id)
    if vendor_id:
        q = q.filter(SubcontractorTaskAllocation.vendor_id == vendor_id)
    if month_year:
        q = q.filter(SubcontractorTaskAllocation.month_year == month_year)
    rows = q.order_by(
        SubcontractorTaskAllocation.month_year,
        SubcontractorTaskAllocation.major_task_name,
    ).all()
    return [TaskAllocationOut.model_validate(r) for r in rows]


@router.post("", response_model=TaskAllocationOut)
def create_task_allocation(data: TaskAllocationCreate, db: Session = Depends(get_db)):
    row = SubcontractorTaskAllocation(**data.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return TaskAllocationOut.model_validate(row)


@router.put("/{alloc_id}", response_model=TaskAllocationOut)
def update_task_allocation(alloc_id: str, data: TaskAllocationUpdate, db: Session = Depends(get_db)):
    row = db.query(SubcontractorTaskAllocation).filter(
        SubcontractorTaskAllocation.id == alloc_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Allocation not found")
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return TaskAllocationOut.model_validate(row)


@router.delete("/{alloc_id}", status_code=204)
def delete_task_allocation(alloc_id: str, db: Session = Depends(get_db)):
    row = db.query(SubcontractorTaskAllocation).filter(
        SubcontractorTaskAllocation.id == alloc_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Allocation not found")
    db.delete(row)
    db.commit()


@router.get("/payout-report")
def payout_report(contract_id: str, month_year: str, db: Session = Depends(get_db)):
    """
    Returns what to pay each subcontractor for a given month,
    broken down by task, with per-vendor totals.
    """
    rows = (
        db.query(SubcontractorTaskAllocation)
        .filter(
            SubcontractorTaskAllocation.contract_id == contract_id,
            SubcontractorTaskAllocation.month_year == month_year,
        )
        .all()
    )

    lines = []
    vendor_totals: dict[str, float] = {}
    grand_total = 0.0

    for r in rows:
        vendor = db.query(Vendor).filter(Vendor.id == r.vendor_id).first()
        vendor_name = vendor.display_name if vendor else r.vendor_id
        amount = float(r.month_amount)
        lines.append({
            "vendor_id": r.vendor_id,
            "vendor_name": vendor_name,
            "major_task_name": r.major_task_name,
            "month_amount": amount,
            "percent_of_task": float(r.percent_of_task),
            "total_task_payment": float(r.total_task_payment),
        })
        vendor_totals[vendor_name] = round(vendor_totals.get(vendor_name, 0.0) + amount, 2)
        grand_total = round(grand_total + amount, 2)

    lines.sort(key=lambda x: (x["vendor_name"], x["major_task_name"]))
    return {
        "month_year": month_year,
        "lines": lines,
        "vendor_totals": vendor_totals,
        "grand_total": grand_total,
    }
