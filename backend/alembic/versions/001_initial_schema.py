"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-19
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # contracts
    op.create_table(
        "contracts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("contract_start", sa.Date, nullable=True),
        sa.Column("contract_end", sa.Date, nullable=True),
        sa.Column("total_value", sa.Numeric(14, 2), server_default="0"),
        sa.Column("status", sa.Enum("active", "completed", "suspended", name="contractstatus"), server_default="active"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # workstreams
    op.create_table(
        "workstreams",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("contract_id", sa.String(36), sa.ForeignKey("contracts.id"), nullable=False),
        sa.Column("code", sa.String(10), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("active", sa.Boolean, server_default="true"),
    )

    # vendors
    op.create_table(
        "vendors",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("vendor_type", sa.Enum("subcontractor", "venue", "tech", "other", name="vendortype"), server_default="subcontractor"),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("legal_name", sa.String(255), server_default=""),
        sa.Column("email", sa.String(255), server_default=""),
        sa.Column("phone", sa.String(50), server_default=""),
        sa.Column("address", sa.Text, server_default=""),
        sa.Column("w9_received", sa.Boolean, server_default="false"),
        sa.Column("notes", sa.Text, server_default=""),
        sa.Column("active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # client_invoices
    op.create_table(
        "client_invoices",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("contract_id", sa.String(36), sa.ForeignKey("contracts.id"), nullable=False),
        sa.Column("invoice_number", sa.String(50), server_default=""),
        sa.Column("invoice_date", sa.Date, nullable=True),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("billing_period_start", sa.Date, nullable=True),
        sa.Column("billing_period_end", sa.Date, nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), server_default="0"),
        sa.Column("status", sa.Enum("draft", "sent", "partially_paid", "paid", name="invoicestatus"), server_default="draft"),
        sa.Column("notes", sa.Text, server_default=""),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # client_payments
    op.create_table(
        "client_payments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("client_invoice_id", sa.String(36), sa.ForeignKey("client_invoices.id"), nullable=False),
        sa.Column("payment_date", sa.Date, nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), server_default="0"),
        sa.Column("payment_method", sa.Enum("check", "ach", "wire", "other", name="paymentmethod"), server_default="check"),
        sa.Column("reference", sa.String(100), server_default=""),
        sa.Column("deposited_to_account", sa.String(100), server_default=""),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # vendor_bills
    op.create_table(
        "vendor_bills",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("vendor_id", sa.String(36), sa.ForeignKey("vendors.id"), nullable=False),
        sa.Column("contract_id", sa.String(36), sa.ForeignKey("contracts.id"), nullable=False),
        sa.Column("workstream_id", sa.String(36), sa.ForeignKey("workstreams.id"), nullable=True),
        sa.Column("bill_number", sa.String(50), server_default=""),
        sa.Column("bill_date", sa.Date, nullable=True),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("service_period_start", sa.Date, nullable=True),
        sa.Column("service_period_end", sa.Date, nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), server_default="0"),
        sa.Column("status", sa.Enum("draft", "received", "approved", "partially_paid", "paid", name="billstatus"), server_default="received"),
        sa.Column("expense_category", sa.String(100), server_default=""),
        sa.Column("notes", sa.Text, server_default=""),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # vendor_payments
    op.create_table(
        "vendor_payments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("vendor_bill_id", sa.String(36), sa.ForeignKey("vendor_bills.id"), nullable=False),
        sa.Column("payment_date", sa.Date, nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), server_default="0"),
        sa.Column("payment_method", sa.Enum("check", "ach", "wire", "other", name="paymentmethod", create_type=False)),
        sa.Column("reference", sa.String(100), server_default=""),
        sa.Column("paid_from_account", sa.String(100), server_default=""),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # direct_costs
    op.create_table(
        "direct_costs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("contract_id", sa.String(36), sa.ForeignKey("contracts.id"), nullable=False),
        sa.Column("workstream_id", sa.String(36), sa.ForeignKey("workstreams.id"), nullable=True),
        sa.Column("vendor_id", sa.String(36), sa.ForeignKey("vendors.id"), nullable=True),
        sa.Column("cost_date", sa.Date, nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), server_default="0"),
        sa.Column("category", sa.String(100), server_default=""),
        sa.Column("status", sa.Enum("planned", "incurred", "paid", name="directcoststatus"), server_default="incurred"),
        sa.Column("notes", sa.Text, server_default=""),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # monthly_forecast
    op.create_table(
        "monthly_forecast",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("contract_id", sa.String(36), sa.ForeignKey("contracts.id"), nullable=False),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("workstream_id", sa.String(36), sa.ForeignKey("workstreams.id"), nullable=True),
        sa.Column("vendor_id", sa.String(36), sa.ForeignKey("vendors.id"), nullable=True),
        sa.Column("forecast_type", sa.Enum("revenue", "subcontractor_cost", "direct_cost", "overhead", name="forecasttype"), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), server_default="0"),
        sa.Column("confidence_level", sa.String(20), server_default=""),
        sa.Column("notes", sa.Text, server_default=""),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # bank_accounts
    op.create_table(
        "bank_accounts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.Enum("checking", "savings", name="bankaccounttype"), server_default="checking"),
        sa.Column("opening_balance", sa.Numeric(14, 2), server_default="0"),
        sa.Column("active", sa.Boolean, server_default="true"),
    )


def downgrade() -> None:
    op.drop_table("monthly_forecast")
    op.drop_table("direct_costs")
    op.drop_table("vendor_payments")
    op.drop_table("vendor_bills")
    op.drop_table("client_payments")
    op.drop_table("client_invoices")
    op.drop_table("vendors")
    op.drop_table("workstreams")
    op.drop_table("bank_accounts")
    op.drop_table("contracts")
    for name in ["contractstatus", "vendortype", "invoicestatus", "billstatus", "paymentmethod", "directcoststatus", "forecasttype", "bankaccounttype"]:
        op.execute(f"DROP TYPE IF EXISTS {name}")
