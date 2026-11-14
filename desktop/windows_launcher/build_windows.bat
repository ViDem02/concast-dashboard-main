@echo off
setlocal enabledelayedexpansion

REM Build ConcastDashboard.exe (Windows only).
REM Prereq (build machine): Python 3.11+ installed.

cd /d %~dp0

if not exist .venv (
  python -m venv .venv
)

call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install pyinstaller==6.6.0

pyinstaller --clean --noconfirm concast_dashboard_launcher.spec
if errorlevel 1 (
  echo.
  echo Build failed during PyInstaller step.
  exit /b 1
)

echo.
echo Build complete.
echo Output: dist\\ConcastDashboard.exe
endlocal
