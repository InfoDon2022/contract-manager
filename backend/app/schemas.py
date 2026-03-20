from pydantic import BaseModel
from decimal import Decimal
from datetime import date
from typing import Optional


# ── Contracts ──

class ContractBase(BaseModel):
    name: str
    client_name: str
    contract_start: Optional[date] = None
    contract_end: Optional[date] = None
    total_value: Decimal = Decimal("0")
    status: str = "active"

class ContractCreate(ContractBase):
    pass

class ContractUpdate(ContractBase):
    pass

class ContractOut(ContractBase):
    id: str
    model_config = {"from_attributes": True}


# ── Workstreams ──

class WorkstreamBase(BaseModel):
    contract_id: str
    code: str
    name: str
    description: str = ""
    active: bool = True

class WorkstreamCreate(WorkstreamBase):
    pass

class WorkstreamOut(WorkstreamBase):
    id: str
    model_config = {"from_attributes": True}


# ── Vendors ──

class VendorBase(BaseModel):
    vendor_type: str = "subcontractor"
    display_name: str
    legal_name: str = ""
    email: str = ""
    phone: str = ""
    address: str = ""
    w9_received: bool = False
    notes: str = ""
    active: bool = True

class VendorCreate(VendorBase):
    pass

class VendorUpdate(VendorBase):
    pass

class VendorOut(VendorBase):
    id: str
    model_config = {"from_attributes": True}


# ── Client Invoices ──

class ClientInvoiceBase(BaseModel):
    contract_id: str
    invoice_number: str = ""
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    billing_period_start: Optional[date] = None
    billing_period_end: Optional[date] = None
    amount: Decimal = Decimal("0")
    status: str = "draft"
    notes: str = ""

class ClientInvoiceCreate(ClientInvoiceBase):
    pass

class ClientInvoiceUpdate(ClientInvoiceBase):
    pass

class ClientInvoiceOut(ClientInvoiceBase):
    id: str
    model_config = {"from_attributes": True}


# ── Client Payments ──

class ClientPaymentBase(BaseModel):
    client_invoice_id: str
    payment_date: Optional[date] = None
    amount: Decimal = Decimal("0")
    payment_method: str = "check"
    reference: str = ""
    deposited_to_account: str = ""

class ClientPaymentCreate(ClientPaymentBase):
    pass

class ClientPaymentOut(ClientPaymentBase):
    id: str
    model_config = {"from_attributes": True}


# ── Vendor Bills ──

class VendorBillBase(BaseModel):
    vendor_id: str
    contract_id: str
    workstream_id: Optional[str] = None
    bill_number: str = ""
    bill_date: Optional[date] = None
    due_date: Optional[date] = None
    service_period_start: Optional[date] = None
    service_period_end: Optional[date] = None
    amount: Decimal = Decimal("0")
    status: str = "received"
    expense_category: str = ""
    notes: str = ""

class VendorBillCreate(VendorBillBase):
    pass

class VendorBillUpdate(VendorBillBase):
    pass

class VendorBillOut(VendorBillBase):
    id: str
    model_config = {"from_attributes": True}


# ── Vendor Payments ──

class VendorPaymentBase(BaseModel):
    vendor_bill_id: str
    payment_date: Optional[date] = None
    amount: Decimal = Decimal("0")
    payment_method: str = "check"
    reference: str = ""
    paid_from_account: str = ""

class VendorPaymentCreate(VendorPaymentBase):
    pass

class VendorPaymentOut(VendorPaymentBase):
    id: str
    model_config = {"from_attributes": True}


# ── Direct Costs ──

class DirectCostBase(BaseModel):
    contract_id: str
    workstream_id: Optional[str] = None
    vendor_id: Optional[str] = None
    cost_date: Optional[date] = None
    amount: Decimal = Decimal("0")
    category: str = ""
    status: str = "incurred"
    notes: str = ""

class DirectCostCreate(DirectCostBase):
    pass

class DirectCostUpdate(DirectCostBase):
    pass

class DirectCostOut(DirectCostBase):
    id: str
    model_config = {"from_attributes": True}


# ── Monthly Forecast ──

class ForecastBase(BaseModel):
    contract_id: str
    month: str
    workstream_id: Optional[str] = None
    vendor_id: Optional[str] = None
    forecast_type: str
    amount: Decimal = Decimal("0")
    confidence_level: str = ""
    notes: str = ""

class ForecastCreate(ForecastBase):
    pass

class ForecastUpdate(ForecastBase):
    pass

class ForecastOut(ForecastBase):
    id: str
    model_config = {"from_attributes": True}


# ── Bank Accounts ──

class BankAccountBase(BaseModel):
    name: str
    type: str = "checking"
    opening_balance: Decimal = Decimal("0")
    active: bool = True

class BankAccountCreate(BankAccountBase):
    pass

class BankAccountUpdate(BankAccountBase):
    pass

class BankAccountOut(BankAccountBase):
    id: str
    model_config = {"from_attributes": True}


# ── Dashboard ──

class DashboardOut(BaseModel):
    cash_on_hand: Decimal
    total_billed: Decimal
    total_collected: Decimal
    outstanding_ar: Decimal
    total_vendor_bills: Decimal
    total_vendor_paid: Decimal
    unpaid_ap: Decimal
    total_direct_costs: Decimal
    total_costs: Decimal
    margin_pct: float
    contract_value: Decimal
    forecast_30: Decimal
    forecast_60: Decimal
    forecast_90: Decimal
    action_items: list[dict]
    monthly_pl: list[dict]
