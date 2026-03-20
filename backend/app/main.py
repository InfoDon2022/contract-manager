import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import (
    contracts, workstreams, vendors, client_invoices,
    vendor_bills, direct_costs, forecast, bank_accounts,
    dashboard, reports,
)

app = FastAPI(
    title="Contract Manager API",
    version="1.0.0",
    description="Backend API for contract management, invoicing, vendor bills, forecasting, and reporting.",
)

# CORS — allow frontend origin(s)
cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(contracts.router)
app.include_router(workstreams.router)
app.include_router(vendors.router)
app.include_router(client_invoices.router)
app.include_router(vendor_bills.router)
app.include_router(direct_costs.router)
app.include_router(forecast.router)
app.include_router(bank_accounts.router)
app.include_router(dashboard.router)
app.include_router(reports.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
