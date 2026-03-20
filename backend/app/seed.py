"""
Seed script: creates initial contract, workstreams, and bank account.
Safe to run multiple times — skips if data already exists.

Usage:  python -m app.seed
"""
from datetime import date
from decimal import Decimal
from app.database import SessionLocal
from app.models.models import Contract, Workstream, BankAccount, new_id


def seed():
    db = SessionLocal()
    try:
        # Skip if contract already exists
        if db.query(Contract).first():
            print("Database already seeded — skipping.")
            return

        contract_id = new_id()
        contract = Contract(
            id=contract_id,
            name="VT State Contract",
            client_name="State of Vermont",
            contract_start=date(2025, 1, 1),
            contract_end=date(2025, 12, 31),
            total_value=Decimal("500000.00"),
            status="active",
        )
        db.add(contract)

        workstreams = [
            ("IMPL", "Implementation Plan"),
            ("EXEC", "Executive Committee"),
            ("COAL", "Coalition Meetings"),
            ("TRNG", "Training and TA"),
            ("DASH", "Dashboard/Data"),
            ("DRCT", "Direct Costs"),
        ]
        for code, name in workstreams:
            db.add(Workstream(
                id=new_id(),
                contract_id=contract_id,
                code=code,
                name=name,
                description="",
                active=True,
            ))

        db.add(BankAccount(
            id=new_id(),
            name="Operating Account",
            type="checking",
            opening_balance=Decimal("0.00"),
            active=True,
        ))

        db.commit()
        print("Database seeded successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
