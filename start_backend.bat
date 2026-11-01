@echo off
title SilentGuard Lab - FastAPI Backend
echo ========================================================
echo   Menjalankan Backend FastAPI SilentGuard Lab di :8000
echo ========================================================
echo.
set "NUMBA_CACHE_DIR=%~dp0.numba_cache"
if not exist "%NUMBA_CACHE_DIR%" mkdir "%NUMBA_CACHE_DIR%"
cd /d "%~dp0backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause

