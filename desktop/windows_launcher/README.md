# Windows launcher (.exe)

This folder builds a Windows `.exe` that runs the dashboard locally (no Python/Java needed on the target PC).

## What the end user does

1. Double-click `ConcastDashboard.exe`
2. A tray icon appears (near the clock)
3. Open `http://127.0.0.1:5000/` in a browser to use the dashboard
4. Right-click tray icon → **Quit** to stop

> Note: On first run Windows Firewall may ask for permission. Allow on **Private networks**.

## Build (on a Windows machine)

Prerequisites (build machine only):
- Python 3.11+ installed

Steps:
1. Open `cmd.exe`
2. `cd` into this folder
3. Run:

```bat
build_windows.bat
```

Output:
- `dist\ConcastDashboard.exe`

## Build with GitHub Actions (no Windows machine)

If this repo is on GitHub, you can build the Windows `.exe` from CI:

1. Push your changes
2. Go to GitHub → **Actions** → **Build Windows EXE**
3. Click **Run workflow** (or wait for it to run on push)
4. Download the artifact **ConcastDashboard-windows-exe**

## Logs

The launcher writes logs to:
- `%LOCALAPPDATA%\ConcastDashboard\logs\launcher.log`
