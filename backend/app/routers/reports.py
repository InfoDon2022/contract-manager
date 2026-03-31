from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.models import (
    ClientInvoice, ClientPayment, VendorBill, VendorPayment,
    DirectCost, Vendor, MonthlyForecast, Contract,
)
from app.routers.weekly_entries import _compute_summary

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/pl")
def profit_and_loss(db: Session = Depends(get_db)):
    """P&L by month."""
    inv_months = db.query(func.to_char(ClientInvoice.invoice_date, 'YYYY-MM').label("m")).filter(ClientInvoice.invoice_date.isnot(None)).distinct().all()
    bill_months = db.query(func.to_char(VendorBill.bill_date, 'YYYY-MM').label("m")).filter(VendorBill.bill_date.isnot(None)).distinct().all()
    dc_months = db.query(func.to_char(DirectCost.cost_date, 'YYYY-MM').label("m")).filter(DirectCost.cost_date.isnot(None)).distinct().all()
    months = sorted(set(r.m for r in inv_months + bill_months + dc_months))

    rows = []
    for m in months:
        rev = db.query(func.coalesce(func.sum(ClientInvoice.amount), 0)).filter(func.to_char(ClientInvoice.invoice_date, 'YYYY-MM') == m).scalar()
        sub = db.query(func.coalesce(func.sum(VendorBill.amount), 0)).filter(func.to_char(VendorBill.bill_date, 'YYYY-MM') == m).scalar()
        dc = db.query(func.coalesce(func.sum(DirectCost.amount), 0)).filter(func.to_char(DirectCost.cost_date, 'YYYY-MM') == m, DirectCost.status != "planned").scalar()
        rows.append({"month": m, "revenue": float(rev), "sub_costs": float(sub), "direct_costs": float(dc), "total_costs": float(sub + dc), "net": float(rev - sub - dc)})
    return rows


@router.get("/cash-flow")
def cash_flow(db: Session = Depends(get_db)):
    """Cash flow by month (actual money moved)."""
    cp_months = db.query(func.to_char(ClientPayment.payment_date, 'YYYY-MM').label("m")).filter(ClientPayment.payment_date.isnot(None)).distinct().all()
    vp_months = db.query(func.to_char(VendorPayment.payment_date, 'YYYY-MM').label("m")).filter(VendorPayment.payment_date.isnot(None)).distinct().all()
    dc_months = db.query(func.to_char(DirectCost.cost_date, 'YYYY-MM').label("m")).filter(DirectCost.cost_date.isnot(None), DirectCost.status == "paid").distinct().all()
    months = sorted(set(r.m for r in cp_months + vp_months + dc_months))

    rows = []
    for m in months:
        inflows = db.query(func.coalesce(func.sum(ClientPayment.amount), 0)).filter(func.to_char(ClientPayment.payment_date, 'YYYY-MM') == m).scalar()
        vp_out = db.query(func.coalesce(func.sum(VendorPayment.amount), 0)).filter(func.to_char(VendorPayment.payment_date, 'YYYY-MM') == m).scalar()
        dc_out = db.query(func.coalesce(func.sum(DirectCost.amount), 0)).filter(func.to_char(DirectCost.cost_date, 'YYYY-MM') == m, DirectCost.status == "paid").scalar()
        outflows = vp_out + dc_out
        rows.append({"month": m, "inflows": float(inflows), "outflows": float(outflows), "net": float(inflows - outflows)})
    return rows


@router.get("/vendor-summary")
def vendor_summary(db: Session = Depends(get_db)):
    """Unpaid balance per vendor."""
    vendors = db.query(Vendor).all()
    rows = []
    for v in vendors:
        billed = db.query(func.coalesce(func.sum(VendorBill.amount), 0)).filter(VendorBill.vendor_id == v.id).scalar()
        if billed == 0:
            continue
        bill_ids = [b.id for b in db.query(VendorBill.id).filter(VendorBill.vendor_id == v.id).all()]
        paid = Decimal("0")
        if bill_ids:
            paid = db.query(func.coalesce(func.sum(VendorPayment.amount), 0)).filter(VendorPayment.vendor_bill_id.in_(bill_ids)).scalar()
        rows.append({"vendor_id": v.id, "display_name": v.display_name, "billed": float(billed), "paid": float(paid), "unpaid": float(billed - paid)})
    return rows


@router.get("/billed-vs-collected")
def billed_vs_collected(db: Session = Depends(get_db)):
    billed = db.query(func.coalesce(func.sum(ClientInvoice.amount), 0)).scalar()
    collected = db.query(func.coalesce(func.sum(ClientPayment.amount), 0)).scalar()
    outstanding = billed - collected
    pct = float(collected / billed * 100) if billed > 0 else 0
    return {"billed": float(billed), "collected": float(collected), "outstanding": float(outstanding), "collection_rate": pct}


@router.get("/generate-invoice")
def generate_invoice(contract_id: str, month_year: str, db: Session = Depends(get_db)):
    """
    Generates a monthly invoice to the State of Vermont.
    Billable = ops_cost + proportional owner margin, converted to hours at $145/hr.
    Broken down by task code.
    """
    BILLING_RATE = Decimal("145")
    weeks, total_ops, owner_draw = _compute_summary(contract_id, db)
    contract = db.query(Contract).filter(Contract.id == contract_id).first()

    # Collect only weeks whose week_start falls in month_year
    month_weeks = [w for w in weeks if w["week_start"][:7] == month_year]

    task_billable: dict[str, float] = {}
    monthly_ops = 0.0
    monthly_billable = 0.0

    for w in month_weeks:
        monthly_ops += w["ops_cost"]
        monthly_billable += w["billable"]
        week_ops = w["ops_cost"]
        for entry in w["entries"]:
            tc = entry["task_code"]
            entry_cost = entry["line_cost"]
            if week_ops > 0:
                entry_billable = (entry_cost / week_ops) * w["billable"]
            else:
                entry_billable = 0.0
            task_billable[tc] = round(task_billable.get(tc, 0.0) + entry_billable, 2)

    lines = []
    for tc in sorted(task_billable.keys()):
        amount = task_billable[tc]
        hours = round(amount / float(BILLING_RATE), 2)
        lines.append({
            "task_code": tc,
            "billable_amount": amount,
            "hours_equivalent": hours,
        })

    total_hours = round(monthly_billable / float(BILLING_RATE), 2)
    return {
        "contract_id": contract_id,
        "contract_name": contract.name if contract else "",
        "client_name": contract.client_name if contract else "",
        "month_year": month_year,
        "billing_rate": float(BILLING_RATE),
        "lines": lines,
        "total_amount": round(monthly_billable, 2),
        "total_hours": total_hours,
        "ops_cost": round(monthly_ops, 2),
        "owner_margin": round(monthly_billable - monthly_ops, 2),
    }


@router.get("/forecast-vs-actual")
def forecast_vs_actual(db: Session = Depends(get_db)):
    """Forecast vs actual by month."""
    fc_months = db.query(MonthlyForecast.month).distinct().all()
    inv_months = db.query(func.to_char(ClientInvoice.invoice_date, 'YYYY-MM').label("m")).filter(ClientInvoice.invoice_date.isnot(None)).distinct().all()
    bill_months = db.query(func.to_char(VendorBill.bill_date, 'YYYY-MM').label("m")).filter(VendorBill.bill_date.isnot(None)).distinct().all()
    months = sorted(set([r.month for r in fc_months] + [r.m for r in inv_months + bill_months]))

    rows = []
    for m in months:
        f_rev = float(db.query(func.coalesce(func.sum(MonthlyForecast.amount), 0)).filter(MonthlyForecast.month == m, MonthlyForecast.forecast_type == "revenue").scalar())
        f_cost = float(db.query(func.coalesce(func.sum(MonthlyForecast.amount), 0)).filter(MonthlyForecast.month == m, MonthlyForecast.forecast_type != "revenue").scalar())
        a_rev = float(db.query(func.coalesce(func.sum(ClientInvoice.amount), 0)).filter(func.to_char(ClientInvoice.invoice_date, 'YYYY-MM') == m).scalar())
        a_cost_sub = float(db.query(func.coalesce(func.sum(VendorBill.amount), 0)).filter(func.to_char(VendorBill.bill_date, 'YYYY-MM') == m).scalar())
        a_cost_dc = float(db.query(func.coalesce(func.sum(DirectCost.amount), 0)).filter(func.to_char(DirectCost.cost_date, 'YYYY-MM') == m, DirectCost.status != "planned").scalar())
        rows.append({
            "month": m,
            "forecast_revenue": f_rev, "forecast_cost": f_cost, "forecast_net": f_rev - f_cost,
            "actual_revenue": a_rev, "actual_cost": a_cost_sub + a_cost_dc, "actual_net": a_rev - a_cost_sub - a_cost_dc,
        })
    return rows
