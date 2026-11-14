# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

block_cipher = None

# PyInstaller executes this spec via `exec()` and may not define `__file__`.
# We rely on the build scripts setting the working directory to this folder.
spec_dir = Path.cwd()
repo_root = spec_dir.parents[1]

# Bundle the dashboard static site into the exe.
# PyInstaller will extract this folder under sys._MEIPASS/dashboard
app_datas = [
    (str(repo_root / "apps" / "dashboard"), "dashboard"),
]

a = Analysis(
    [str((spec_dir / "launcher.py").resolve())],
    pathex=[str(spec_dir)],
    binaries=[],
    datas=app_datas,
    hiddenimports=[
        "pystray._win32",
        "pystray._util.win32",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    exclude_binaries=False,
    name="ConcastDashboard",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # windowless
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
