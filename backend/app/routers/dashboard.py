from datetime import date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.models import (
    Contract, ClientInvoice, ClientPayment, VendorBill, VendorPayment,
    DirectCost, MonthlyForecast, BankAccount, Vendor,
)
from app.schemas import DashboardOut

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOut)
def get_dashboard(db: Session = Depends(get_db)):
    contract = db.query(Contract).first()
    contract_value = contract.total_value if contract else Decimal("0")

    # Totals
    total_billed = db.query(func.coalesce(func.sum(ClientInvoice.amount), 0)).scalar()
    total_collected = db.query(func.coalesce(func.sum(ClientPayment.amount), 0)).scalar()
    outstanding_ar = total_billed - total_collected

    total_vendor_bills = db.query(func.coalesce(func.sum(VendorBill.amount), 0)).scalar()
    total_vendor_paid = db.query(func.coalesce(func.sum(VendorPayment.amount), 0)).scalar()
    unpaid_ap = total_vendor_bills - total_vendor_paid

    total_direct_costs = (
        db.query(func.coalesce(func.sum(DirectCost.amount), 0))
        .filter(DirectCost.status != "planned")
        .scalar()
    )
    total_costs = total_vendor_bills + total_direct_costs

    # Cash on hand
    opening_bal = db.query(func.coalesce(func.sum(BankAccount.opening_balance), 0)).scalar()
    direct_paid = (
        db.query(func.coalesce(func.sum(DirectCost.amount), 0))
        .filter(DirectCost.status == "paid")
        .scalar()
    )
    cash_on_hand = opening_bal + total_collected - total_vendor_paid - direct_paid

    # Margin
    margin_pct = float((total_billed - total_costs) / total_billed * 100) if total_billed > 0 else 0.0

    # Forecast windows
    today_str = date.today().strftime("%Y-%m")
    forecasts = {}
    for days in [30, 60, 90]:
        cutoff = (date.today() + timedelta(days=days)).strftime("%Y-%m")
        rows = (
            db.query(MonthlyForecast)
            .filter(MonthlyForecast.month >= today_str, MonthlyForecast.month <= cutoff)
            .all()
        )
        rev = sum(r.amount for r in rows if r.forecast_type == "revenue")
        cost = sum(r.amount for r in rows if r.forecast_type != "revenue")
        forecasts[days] = rev - cost

    # Action items
    actions = []
    draft_count = db.query(ClientInvoice).filter(ClientInvoice.status == "draft").count()
    if draft_count:
        actions.append({"icon": "📤", "text": f"{draft_count} draft invoice(s) to send", "priority": "high"})

    overdue_bills = (
        db.query(VendorBill)
        .filter(VendorBill.due_date < date.today(), VendorBill.status.notin_(["paid"]))
        .count()
    )
    if overdue_bills:
        actions.append({"icon": "🔴", "text": f"{overdue_bills} overdue vendor bill(s)", "priority": "high"})

    unpaid_bill_count = db.query(VendorBill).filter(VendorBill.status != "paid").count()
    if unpaid_bill_count:
        actions.append({"icon": "💰", "text": f"{unpaid_bill_count} vendor bill(s) to pay ({float(unpaid_ap):.2f})", "priority": "medium"})

    missing_w9 = (
        db.query(Vendor)
        .filter(Vendor.w9_received == False, Vendor.vendor_type == "subcontractor")
        .count()
    )
    if missing_w9:
        actions.append({"icon": "📋", "text": f"{missing_w9} subcontractor(s) missing W-9", "priority": "medium"})

    outstanding_inv = (
        db.query(ClientInvoice)
        .filter(ClientInvoice.status.in_(["sent", "partially_paid"]))
        .count()
    )
    if outstanding_inv:
        actions.append({"icon": "⏳", "text": f"{outstanding_inv} outstanding client invoice(s)", "priority": "low"})

    # Monthly P&L
    invoice_months = (
        db.query(func.to_char(ClientInvoice.invoice_date, 'YYYY-MM').label("month"))
        .filter(ClientInvoice.invoice_date.isnot(None))
        .distinct()
        .all()
    )
    bill_months = (
        db.query(func.to_char(VendorBill.bill_date, 'YYYY-MM').label("month"))
        .filter(VendorBill.bill_date.isnot(None))
        .distinct()
        .all()
    )
    all_months = sorted(set(r.month for r in invoice_months + bill_months))

    monthly_pl = []
    for m in all_months:
        rev = (
            db.query(func.coalesce(func.sum(ClientInvoice.amount), 0))
            .filter(func.to_char(ClientInvoice.invoice_date, 'YYYY-MM') == m)
            .scalar()
        )
        cost = (
            db.query(func.coalesce(func.sum(VendorBill.amount), 0))
            .filter(func.to_char(VendorBill.bill_date, 'YYYY-MM') == m)
            .scalar()
        )
        dcost = (
            db.query(func.coalesce(func.sum(DirectCost.amount), 0))
            .filter(
                func.to_char(DirectCost.cost_date, 'YYYY-MM') == m,
                DirectCost.status != "planned",
            )
            .scalar()
        )
        monthly_pl.append({"month": m, "revenue": float(rev), "costs": float(cost + dcost), "net": float(rev - cost - dcost)})

    return DashboardOut(
        cash_on_hand=cash_on_hand,
        total_billed=total_billed,
        total_collected=total_collected,
        outstanding_ar=outstanding_ar,
        total_vendor_bills=total_vendor_bills,
        total_vendor_paid=total_vendor_paid,
        unpaid_ap=unpaid_ap,
        total_direct_costs=total_direct_costs,
        total_costs=total_costs,
        margin_pct=margin_pct,
        contract_value=contract_value,
        forecast_30=forecasts[30],
        forecast_60=forecasts[60],
        forecast_90=forecasts[90],
        action_items=actions,
        monthly_pl=monthly_pl,
    )
