@echo off
setlocal

where py >nul 2>nul
if %errorlevel%==0 (
  py -m uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir flowsim-backend
  exit /b %errorlevel%
)

where python >nul 2>nul
if %errorlevel%==0 (
  python -m uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir flowsim-backend
  exit /b %errorlevel%
)

echo Python was not found on PATH.
echo Install Python 3, then run scripts\install-backend.cmd and try again.
exit /b 1
