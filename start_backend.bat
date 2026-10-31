@echo off
title SilentGuard Lab - FastAPI Backend
echo ========================================================
echo   Menjalankan Backend FastAPI SilentGuard Lab di :8000
echo ========================================================
echo.
cd /d "%~dp0backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause

