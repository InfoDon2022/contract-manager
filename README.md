# Contract Manager

A contract management application for tracking state contracts, subcontractors, invoices, vendor bills, forecasts, and cash flow.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  FastAPI Backend │────▶│  PostgreSQL DB  │
│  (Render Static)│     │  (Render Web Svc)│     │ (Render Postgres)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

- **Frontend**: React SPA served as a Render Static Site
- **Backend**: FastAPI with SQLAlchemy ORM, deployed as a Render Web Service
- **Database**: Render Managed PostgreSQL

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL (local or use Render's external connection)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set environment variable
export DATABASE_URL="postgresql://user:pass@localhost:5432/contract_manager"

# Run migrations
alembic upgrade head

# Seed initial data
python -m app.seed

# Start dev server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev
```

Open http://localhost:5173

## Deploying to Render

### Step 1: Create a PostgreSQL Database

1. Go to https://dashboard.render.com
2. Click **New** → **PostgreSQL**
3. Name: `contract-manager-db`
4. Choose the **Free** tier to start (or Starter for production)
5. Click **Create Database**
6. Copy the **Internal Database URL** — you'll need it in Step 2

### Step 2: Deploy the Backend

1. Push this repo to GitHub
2. In Render, click **New** → **Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Name**: `contract-manager-api`
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `alembic upgrade head && python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment Variables**:
     - `DATABASE_URL` = (paste Internal Database URL from Step 1)
     - `CORS_ORIGINS` = `https://your-frontend-url.onrender.com`
5. Click **Create Web Service**
6. Copy the service URL (e.g., `https://contract-manager-api.onrender.com`)

### Step 3: Deploy the Frontend

1. In Render, click **New** → **Static Site**
2. Connect the same GitHub repo
3. Configure:
   - **Name**: `contract-manager`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - **Environment Variables**:
     - `VITE_API_URL` = (paste backend URL from Step 2)
4. Add a **Rewrite Rule**: Source `/*` → Destination `/index.html` (for SPA routing)
5. Click **Create Static Site**

### Step 4: Update CORS

Go back to your backend Web Service and update `CORS_ORIGINS` to match your actual frontend URL.

## Project Structure

```
contract-manager/
├── backend/
│   ├── alembic/              # Database migrations
│   ├── app/
│   │   ├── main.py           # FastAPI app entry point
│   │   ├── database.py       # SQLAlchemy engine & session
│   │   ├── models/
│   │   │   └── models.py     # All SQLAlchemy models
│   │   ├── routers/
│   │   │   ├── contracts.py
│   │   │   ├── workstreams.py
│   │   │   ├── vendors.py
│   │   │   ├── client_invoices.py
│   │   │   ├── client_payments.py
│   │   │   ├── vendor_bills.py
│   │   │   ├── vendor_payments.py
│   │   │   ├── direct_costs.py
│   │   │   ├── forecast.py
│   │   │   ├── bank_accounts.py
│   │   │   └── dashboard.py
│   │   └── seed.py           # Initial data seeding
│   ├── alembic.ini
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── lib/api.js        # API client
│   │   └── ...
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Data Model

The database includes these tables:

- **contracts** — One row per contract
- **workstreams** — Cost categories (Implementation Plan, Training, etc.)
- **vendors** — Subcontractors and other payees
- **client_invoices** — Invoices sent to the state
- **client_payments** — Payments received from the state
- **vendor_bills** — Bills received from subcontractors
- **vendor_payments** — Payments made to subcontractors
- **direct_costs** — Non-subcontractor project costs
- **monthly_forecast** — Projected future revenue and costs
- **bank_accounts** — Bank account balances

## Business Rules

- Forecast entries never hit actual cash or actual P&L
- Vendor bills hit obligations and actual cost
- Vendor payments reduce cash and reduce open obligations
- Client invoices increase receivables
- Client payments increase cash and reduce receivables
- A vendor cannot be marked 1099-ready unless W-9 received is true
- Every bill and forecast row optionally ties to a workstream
