"""add weekly entries, task allocations, owner profit

Revision ID: 002
Revises: 001
Create Date: 2026-03-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "weekly_entries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("contract_id", sa.String(36), sa.ForeignKey("contracts.id"), nullable=False),
        sa.Column("week_number", sa.Integer, nullable=False),
        sa.Column("week_start", sa.Date, nullable=False),
        sa.Column("week_end", sa.Date, nullable=False),
        sa.Column("person_name", sa.String(100), nullable=False),
        sa.Column("major_task", sa.String(255), server_default=""),
        sa.Column("task_code", sa.String(10), nullable=False),
        sa.Column("subtask_description", sa.Text, server_default=""),
        sa.Column(
            "entry_type",
            sa.Enum("hourly_labor", "flat_fee", "direct_cost", "travel_stipend", name="entrytype"),
            nullable=False,
        ),
        sa.Column("hourly_rate", sa.Numeric(10, 2), nullable=True),
        sa.Column("hours", sa.Numeric(8, 4), nullable=True),
        sa.Column("flat_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_weekly_entries_contract_week", "weekly_entries", ["contract_id", "week_number"])
    op.create_index("ix_weekly_entries_contract_month", "weekly_entries", ["contract_id", "week_start"])

    op.create_table(
        "subcontractor_task_allocations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("contract_id", sa.String(36), sa.ForeignKey("contracts.id"), nullable=False),
        sa.Column("vendor_id", sa.String(36), sa.ForeignKey("vendors.id"), nullable=False),
        sa.Column("major_task_name", sa.String(255), nullable=False),
        sa.Column("total_task_payment", sa.Numeric(14, 2), server_default="0"),
        sa.Column("month_year", sa.String(7), nullable=False),
        sa.Column("month_amount", sa.Numeric(14, 2), server_default="0"),
        sa.Column("percent_of_task", sa.Numeric(6, 4), server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_sta_contract_vendor_month",
        "subcontractor_task_allocations",
        ["contract_id", "vendor_id", "month_year"],
    )

    op.create_table(
        "owner_profit_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("contract_id", sa.String(36), sa.ForeignKey("contracts.id"), nullable=False),
        sa.Column("month_year", sa.String(7), nullable=False),
        sa.Column("gross_income", sa.Numeric(14, 2), server_default="0"),
        sa.Column("subcontractor_costs", sa.Numeric(14, 2), server_default="0"),
        sa.Column("direct_expenses", sa.Numeric(14, 2), server_default="0"),
        sa.Column("indirect_expenses", sa.Numeric(14, 2), server_default="0"),
        sa.Column("owner_profit", sa.Numeric(14, 2), server_default="0"),
        sa.Column("tax_rate", sa.Numeric(5, 4), server_default="0.4000"),
        sa.Column("tax_set_aside", sa.Numeric(14, 2), server_default="0"),
        sa.Column("net_profit", sa.Numeric(14, 2), server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_profit_contract_month", "owner_profit_records", ["contract_id", "month_year"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_profit_contract_month", "owner_profit_records", type_="unique")
    op.drop_table("owner_profit_records")
    op.drop_index("ix_sta_contract_vendor_month", "subcontractor_task_allocations")
    op.drop_table("subcontractor_task_allocations")
    op.drop_index("ix_weekly_entries_contract_month", "weekly_entries")
    op.drop_index("ix_weekly_entries_contract_week", "weekly_entries")
    op.drop_table("weekly_entries")
    op.execute("DROP TYPE IF EXISTS entrytype")
