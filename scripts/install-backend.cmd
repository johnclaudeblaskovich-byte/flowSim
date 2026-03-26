@echo off
setlocal

where py >nul 2>nul
if %errorlevel%==0 (
  py -m pip install -r flowsim-backend\requirements.txt
  exit /b %errorlevel%
)

where python >nul 2>nul
if %errorlevel%==0 (
  python -m pip install -r flowsim-backend\requirements.txt
  exit /b %errorlevel%
)

echo Python was not found on PATH.
echo Install Python 3 and try again.
exit /b 1
