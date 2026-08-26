@echo off
echo Stopping all services...
echo.

:: Stop Docker Compose services gracefully
echo Stopping PostgreSQL / Docker services...
docker-compose down

:: Stop FastAPI/Uvicorn
echo Stopping FastAPI backend...
taskkill /FI "WINDOWTITLE eq Backend FastAPI*" /T /F >nul 2>&1

:: Stop React/Vite
echo Stopping React frontend...
taskkill /FI "WINDOWTITLE eq Frontend React*" /T /F >nul 2>&1

echo.
echo All services have been stopped.
pause