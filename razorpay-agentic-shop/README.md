# Razorpay Agentic Shop

A clean FastAPI + PostgreSQL project for a simple ecommerce catalog.

## Setup

1. Start the database:
   ```bash
   docker-compose up -d
   ```

2. Install dependencies:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. Configure environment:
   ```bash
   cp backend/.env.example backend/.env
   ```

4. Run the application:
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```
