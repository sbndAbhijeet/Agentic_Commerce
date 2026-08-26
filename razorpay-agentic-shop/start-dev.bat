@echo off
echo Starting all services...

:: Start PostgreSQL
start "Docker Postgres" cmd /k "docker-compose up"

:: Wait a few seconds for DB to be ready
timeout /t 5

:: Start Backend
start "Backend FastAPI" cmd /k "cd backend && venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: Start Frontend
start "Frontend React" cmd /k "cd frontend && npm run dev"

echo.
echo All services are starting in separate windows...
echo Backend:  http://localhost:8000/docs
echo Frontend: http://127.0.0.1:5173
pause