from __future__ import annotations

import ctypes
import logging
import os
import socket
import sys
import threading
import webbrowser
from dataclasses import dataclass
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional

import pystray
from PIL import Image, ImageDraw


APP_NAME = "Concast Dashboard"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5000


@dataclass(frozen=True)
class AppPaths:
    dashboard_dir: Path
    log_dir: Path


def _windows_appdata_dir() -> Path:
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        return Path(local_app_data)
    # Fallbacks; should be rare.
    return Path.home() / "AppData" / "Local"


def _get_paths() -> AppPaths:
    # When bundled by PyInstaller, files are extracted under sys._MEIPASS
    base_dir = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))

    # In the PyInstaller spec we bundle apps/dashboard -> dashboard
    dashboard_dir = base_dir / "dashboard"

    log_dir = _windows_appdata_dir() / "ConcastDashboard" / "logs"
    return AppPaths(dashboard_dir=dashboard_dir, log_dir=log_dir)


def _setup_logging(log_dir: Path) -> None:
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "launcher.log"

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[logging.FileHandler(log_path, encoding="utf-8")],
    )


def _message_box(title: str, message: str) -> None:
    # GUI-friendly error message when running windowless.
    try:
        ctypes.windll.user32.MessageBoxW(None, message, title, 0x10)  # MB_ICONERROR
    except Exception:
        # As a last resort, do nothing (no console in windowless mode).
        pass


def _is_port_in_use(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.25)
        return sock.connect_ex((host, port)) == 0


def _make_tray_image() -> Image.Image:
    # Simple self-contained icon; avoids shipping an .ico.
    size = 64
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Outer circle
    draw.ellipse((4, 4, size - 4, size - 4), fill=(30, 41, 59, 255))

    # Inner "C" shape
    draw.arc((14, 14, size - 14, size - 14), start=45, end=315, fill=(255, 255, 255, 255), width=8)
    return image


class _DashboardHandler(SimpleHTTPRequestHandler):
    # Silence noisy request logs (we log to a file ourselves).
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        logging.info("HTTP: " + format, *args)


class Server:
    def __init__(self, dashboard_dir: Path, host: str = DEFAULT_HOST, port: int = DEFAULT_PORT):
        self._dashboard_dir = dashboard_dir
        self._host = host
        self._port = port
        self._httpd: Optional[ThreadingHTTPServer] = None
        self._thread: Optional[threading.Thread] = None

    @property
    def url(self) -> str:
        return f"http://{self._host}:{self._port}/"

    def start(self) -> None:
        if not self._dashboard_dir.exists():
            raise FileNotFoundError(f"Dashboard directory not found: {self._dashboard_dir}")

        # Bind explicitly to localhost.
        handler_cls = self._make_handler(self._dashboard_dir)
        self._httpd = ThreadingHTTPServer((self._host, self._port), handler_cls)

        self._thread = threading.Thread(target=self._httpd.serve_forever, name="http-server", daemon=True)
        self._thread.start()
        logging.info("Serving dashboard from %s at %s", self._dashboard_dir, self.url)

    def stop(self) -> None:
        if self._httpd is None:
            return
        logging.info("Stopping server")
        try:
            self._httpd.shutdown()
            self._httpd.server_close()
        finally:
            self._httpd = None

    @staticmethod
    def _make_handler(dashboard_dir: Path):
        # directory= parameter is available in Python 3.7+
        def handler(*args, **kwargs):
            return _DashboardHandler(*args, directory=str(dashboard_dir), **kwargs)

        return handler


def main() -> int:
    paths = _get_paths()
    _setup_logging(paths.log_dir)

    logging.info("Launcher starting")

    server = Server(paths.dashboard_dir)

    if _is_port_in_use(DEFAULT_HOST, DEFAULT_PORT):
        # Likely another instance is already running.
        logging.info("Port %s already in use; assuming already running", DEFAULT_PORT)
        webbrowser.open(server.url)
        return 0

    try:
        server.start()
    except OSError as exc:
        logging.exception("Failed to start HTTP server")
        _message_box(APP_NAME, f"Cannot start local server on {DEFAULT_HOST}:{DEFAULT_PORT}.\n\n{exc}")
        return 1
    except Exception as exc:
        logging.exception("Fatal startup error")
        _message_box(APP_NAME, f"Startup failed.\n\n{exc}")
        return 1

    def on_open(_icon: pystray.Icon, _item: pystray.MenuItem) -> None:
        webbrowser.open(server.url)

    def on_quit(icon: pystray.Icon, _item: pystray.MenuItem) -> None:
        try:
            server.stop()
        finally:
            icon.stop()

    icon = pystray.Icon(
        name="concast-dashboard",
        title=APP_NAME,
        icon=_make_tray_image(),
        menu=pystray.Menu(
            pystray.MenuItem("Open (127.0.0.1:5000)", on_open, default=True),
            pystray.MenuItem("Quit", on_quit),
        ),
    )

    icon.run()
    logging.info("Launcher exited")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
