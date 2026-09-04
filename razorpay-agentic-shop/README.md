# CampusGadgets AI Commerce

> **Razorpay Buildathon · Track 01 — AI Growth & Agentic Commerce**

CampusGadgets is an end-to-end agentic commerce experience for a student-focused merchant. Buyers discover products conversationally, receive explainable recommendations, build a cart, and complete a Razorpay **Test Mode** payment. Merchants get revenue and inventory visibility plus AI-generated growth recommendations.

## Why this fits Track 01

| Buildathon bar | Implementation |
| --- | --- |
| Conversational commerce | OpenRouter-powered tool-calling shopping assistant at `/api/v1/chat` |
| Agent-readable catalog | Structured search and product-detail tools expose name, description, price, stock, and category |
| Explainable money actions | Explicit confirmation is required before cart changes or order creation; each turn returns a decision log |
| Bounded actions | Allow-listed, authenticated, user-scoped, stock-checked tools with a six-round tool-call limit |
| Gated payment | Orders begin as `pending`; Razorpay Test Mode signature, order association, and exact amount are verified before `paid` |
| Audit trail | User-scoped Audit Logs show tool calls, results, responses, errors, cart IDs, order IDs, and payment verification outcomes |
| Merchant growth | Dashboard metrics and AI recommendations, with a deterministic fallback if the provider is unavailable |
| Graceful failure | Safe handling for provider errors, unavailable products, insufficient stock, cancelled payments, and invalid signatures |

## Demo flow

### Buyer

1. Sign in as a customer and open **Shop**.
2. Ask: `I need headphones for studying under ₹3,000`.
3. Review recommendations, prices, and availability.
4. Confirm: `Add the first one`.
5. Review the cart, proceed to checkout, and use a Razorpay Test Mode payment method.
6. Verify payment, view the order, download the PDF receipt, and inspect **Audit Logs** for the tool and payment trail.

### Merchant

1. Sign in with the seeded merchant account.
2. Open **Merchant Dashboard**.
3. Review paid revenue, orders, low-stock products, recent orders, and top sellers.
4. Select **Generate AI Insights** for recommendations grounded in current dashboard data.

After login, the header and landing-page authentication prompts are hidden. Authenticated merchants see merchant navigation and logout controls instead of Login / Sign Up links.

## Architecture

```text
React + Vite + Tailwind
        │  /api proxy
        ▼
FastAPI + SQLAlchemy + JWT auth
   ┌────┼───────────────┐
   ▼    ▼               ▼
PostgreSQL        OpenRouter       Razorpay Test Mode
catalog/cart      tool-calling     order + signature verification
orders/audit      agent             checkout
```

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Axios, React Router.
- **Backend:** FastAPI, SQLAlchemy, Pydantic Settings, JWT authentication, Passlib/bcrypt.
- **Data:** PostgreSQL 16 through Docker Compose. SQLite is also supported by the backend default, but PostgreSQL is the documented demo path.
- **AI:** OpenRouter through the OpenAI-compatible SDK; default model `openrouter/free`.
- **Payments:** Razorpay Python SDK and hosted Checkout script; only `rzp_test_*` keys are accepted.

### Money and abuse limits

- Maximum quantity per item: **5 units**.
- Maximum cart value: **₹10,00,000**.
- Maximum single order value: **₹10,00,000**.
- Every order re-checks that each product is active, in stock, and priced exactly as currently listed in the catalog.
- Rapid repeated order creation is rate-limited with a friendly cooldown message.
- Blocked cart, order, and payment-verification attempts are written to `AuditLog` with a reason.

## Prerequisites

- Windows 10/11, Python 3.11+, Node.js 18+, npm, and Docker Desktop with Compose
- OpenRouter API key for buyer chat and merchant insights
- Razorpay Test Mode key ID and key secret

## Configuration

The backend reads `backend/.env` because Uvicorn runs from the `backend` directory. Configure it like this:

```env
DATABASE_URL=postgresql://shop_user:shop_password@localhost:5432/shop_db
SECRET_KEY=replace-with-a-long-local-secret
OPENROUTER_API_KEY=your-openrouter-api-key
AGENT_MODEL=openrouter/free
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=
```

Never commit `backend/.env` or real credentials. If `OPENROUTER_API_KEY` is absent, catalog/cart/checkout still work but chat and AI insights do not. Razorpay credentials are required for order creation and payment.

## Run locally

### Windows one-click startup

From the repository root:

1. Install backend dependencies once from `backend\`.
2. Install frontend dependencies once from `frontend\`.
3. Configure `backend\.env`.
4. Run `start-dev.bat`.
5. Open <http://127.0.0.1:5173>.

The launcher starts PostgreSQL, FastAPI at <http://localhost:9000>, and Vite at <http://127.0.0.1:5173>. FastAPI docs are at <http://localhost:9000/docs>.

### Manual startup

Start PostgreSQL from the repository root:

```text
docker compose up -d
```

In a backend PowerShell terminal:

```text
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 9000
```

In a second terminal:

```text
cd frontend
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Vite proxies `/api` to port `9000`. Stop the stack with `stop-dev.bat` or `docker compose down`.

## Seeded demo accounts

Run `python seed.py` from `backend\` to create a fresh catalog, users, sample cart, and pending order. The seed contains 40 products across laptops, headphones, accessories, study essentials, and smartwatches.

| Role | Email | Password |
| --- | --- | --- |
| Customer | `alice@example.com` | `alice-password` |
| Customer | `bob@example.com` | `bob-password` |
| Merchant | `merchant@campusgadgets.com` | `merchant123` |

The seed resets existing application data before reseeding. These accounts are for local demos only.

## API surface

Interactive documentation is exposed at `/docs` and `/redoc`.

- Auth: `POST /api/v1/auth/signup`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
- Catalog: `GET /api/v1/products/`, `/search`, and `/{id}`
- Cart: `POST /api/v1/carts/`, plus cart read/update/delete endpoints
- Agent: `POST /api/v1/chat`
- Payments: `POST /api/v1/orders/`, `/{id}/pay`, and `/verify-payment`
- Orders: `GET /api/v1/orders/`, `/{id}`, and `/{id}/receipt.pdf`
- Audit: `GET /api/v1/audit-logs` and `/{id}`
- Merchant: `GET /api/v1/merchant/dashboard` and `POST /api/v1/merchant/insights`

## Safety and failure handling

Money movement is separated from model output. The model cannot call arbitrary code or directly mark an order paid:

1. The agent can call only registered catalog, cart, and order tools.
2. Tools require the authenticated user’s cart context and validate ownership, activity, quantity, and stock.
3. Order creation creates a local `pending` order and a Razorpay Test Mode order.
4. The browser receives only the public Checkout key and order payload.
5. The backend verifies Razorpay’s signature before setting the order to `paid`.
6. Every agent turn records safe output, tool activity, results/errors, and a compact decision summary.

Cancel Checkout, request more than available stock, or use an invalid product request to demonstrate graceful failure. No live payments are supported.

## Verification checklist

- `GET /health` returns `{"status":"ok"}`.
- `npm run build` in `frontend\` completes successfully.
- Customer and merchant login work with role-based access.
- Chat returns recommendations and a visible decision log.
- Confirmed cart/order actions appear in Audit Logs.
- Razorpay Test Mode payment verification unlocks the receipt.
- Merchant metrics are scoped to the merchant’s products and paid orders.

## Project structure

```text
backend/
  app/routers/       auth, products, carts, chat, orders, audit logs, merchant
  app/services/      agent loop, tools, Razorpay, PDF receipts
  app/core/          settings and JWT/password security
  seed.py
frontend/
  src/pages/         buyer, checkout, orders, audit logs, merchant dashboard
  src/components/    layout, chat, cart, reusable UI
  src/api/            typed API clients
docker-compose.yml
start-dev.bat
stop-dev.bat
```

## Submission notes

This is a Razorpay Test Mode buildathon demo. The strongest evaluation path is **customer login → conversational recommendation → explicit confirmation → cart → Razorpay Test Mode checkout → payment verification → audit log**, followed by **merchant login → dashboard → AI growth insights**. The implementation keeps money actions explainable, bounded, and gated while showing a complete AI-buyer-to-merchant transaction loop.
