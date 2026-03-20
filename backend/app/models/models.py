import uuid
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import (
    String, Text, Numeric, Date, DateTime, Boolean, Enum, ForeignKey, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


def new_id() -> str:
    return str(uuid.uuid4())


# ── Enums ──

class ContractStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    suspended = "suspended"


class VendorType(str, enum.Enum):
    subcontractor = "subcontractor"
    venue = "venue"
    tech = "tech"
    other = "other"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    partially_paid = "partially_paid"
    paid = "paid"


class BillStatus(str, enum.Enum):
    draft = "draft"
    received = "received"
    approved = "approved"
    partially_paid = "partially_paid"
    paid = "paid"


class DirectCostStatus(str, enum.Enum):
    planned = "planned"
    incurred = "incurred"
    paid = "paid"


class ForecastType(str, enum.Enum):
    revenue = "revenue"
    subcontractor_cost = "subcontractor_cost"
    direct_cost = "direct_cost"
    overhead = "overhead"


class PaymentMethod(str, enum.Enum):
    check = "check"
    ach = "ach"
    wire = "wire"
    other = "other"


class BankAccountType(str, enum.Enum):
    checking = "checking"
    savings = "savings"


# ── Models ──

class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(255))
    client_name: Mapped[str] = mapped_column(String(255))
    contract_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    contract_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[ContractStatus] = mapped_column(
        Enum(ContractStatus), default=ContractStatus.active
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    workstreams: Mapped[list["Workstream"]] = relationship(back_populates="contract")
    client_invoices: Mapped[list["ClientInvoice"]] = relationship(back_populates="contract")
    vendor_bills: Mapped[list["VendorBill"]] = relationship(back_populates="contract")
    direct_costs: Mapped[list["DirectCost"]] = relationship(back_populates="contract")
    forecasts: Mapped[list["MonthlyForecast"]] = relationship(back_populates="contract")


class Workstream(Base):
    __tablename__ = "workstreams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    contract_id: Mapped[str] = mapped_column(ForeignKey("contracts.id"))
    code: Mapped[str] = mapped_column(String(10))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    contract: Mapped["Contract"] = relationship(back_populates="workstreams")


class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    vendor_type: Mapped[VendorType] = mapped_column(
        Enum(VendorType), default=VendorType.subcontractor
    )
    display_name: Mapped[str] = mapped_column(String(255))
    legal_name: Mapped[str] = mapped_column(String(255), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    w9_received: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    bills: Mapped[list["VendorBill"]] = relationship(back_populates="vendor")


class ClientInvoice(Base):
    __tablename__ = "client_invoices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    contract_id: Mapped[str] = mapped_column(ForeignKey("contracts.id"))
    invoice_number: Mapped[str] = mapped_column(String(50), default="")
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    billing_period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    billing_period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus), default=InvoiceStatus.draft
    )
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    contract: Mapped["Contract"] = relationship(back_populates="client_invoices")
    payments: Mapped[list["ClientPayment"]] = relationship(back_populates="invoice")


class ClientPayment(Base):
    __tablename__ = "client_payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    client_invoice_id: Mapped[str] = mapped_column(ForeignKey("client_invoices.id"))
    payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod), default=PaymentMethod.check
    )
    reference: Mapped[str] = mapped_column(String(100), default="")
    deposited_to_account: Mapped[str] = mapped_column(String(100), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    invoice: Mapped["ClientInvoice"] = relationship(back_populates="payments")


class VendorBill(Base):
    __tablename__ = "vendor_bills"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    vendor_id: Mapped[str] = mapped_column(ForeignKey("vendors.id"))
    contract_id: Mapped[str] = mapped_column(ForeignKey("contracts.id"))
    workstream_id: Mapped[str | None] = mapped_column(
        ForeignKey("workstreams.id"), nullable=True
    )
    bill_number: Mapped[str] = mapped_column(String(50), default="")
    bill_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    service_period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    service_period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[BillStatus] = mapped_column(
        Enum(BillStatus), default=BillStatus.received
    )
    expense_category: Mapped[str] = mapped_column(String(100), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    vendor: Mapped["Vendor"] = relationship(back_populates="bills")
    contract: Mapped["Contract"] = relationship(back_populates="vendor_bills")
    workstream: Mapped["Workstream | None"] = relationship()
    payments: Mapped[list["VendorPayment"]] = relationship(back_populates="bill")


class VendorPayment(Base):
    __tablename__ = "vendor_payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    vendor_bill_id: Mapped[str] = mapped_column(ForeignKey("vendor_bills.id"))
    payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod), default=PaymentMethod.check
    )
    reference: Mapped[str] = mapped_column(String(100), default="")
    paid_from_account: Mapped[str] = mapped_column(String(100), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    bill: Mapped["VendorBill"] = relationship(back_populates="payments")


class DirectCost(Base):
    __tablename__ = "direct_costs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    contract_id: Mapped[str] = mapped_column(ForeignKey("contracts.id"))
    workstream_id: Mapped[str | None] = mapped_column(
        ForeignKey("workstreams.id"), nullable=True
    )
    vendor_id: Mapped[str | None] = mapped_column(
        ForeignKey("vendors.id"), nullable=True
    )
    cost_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    category: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[DirectCostStatus] = mapped_column(
        Enum(DirectCostStatus), default=DirectCostStatus.incurred
    )
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    contract: Mapped["Contract"] = relationship(back_populates="direct_costs")
    workstream: Mapped["Workstream | None"] = relationship()


class MonthlyForecast(Base):
    __tablename__ = "monthly_forecast"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    contract_id: Mapped[str] = mapped_column(ForeignKey("contracts.id"))
    month: Mapped[str] = mapped_column(String(7))  # "2025-01"
    workstream_id: Mapped[str | None] = mapped_column(
        ForeignKey("workstreams.id"), nullable=True
    )
    vendor_id: Mapped[str | None] = mapped_column(
        ForeignKey("vendors.id"), nullable=True
    )
    forecast_type: Mapped[ForecastType] = mapped_column(Enum(ForecastType))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    confidence_level: Mapped[str] = mapped_column(String(20), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    contract: Mapped["Contract"] = relationship(back_populates="forecasts")
    workstream: Mapped["Workstream | None"] = relationship()


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[BankAccountType] = mapped_column(
        Enum(BankAccountType), default=BankAccountType.checking
    )
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
