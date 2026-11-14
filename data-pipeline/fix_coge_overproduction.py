"""
Fix overproduction of cogenerator in imputated periods: if gas is zero but
`ee_prod_coge_kwh` is > 0, move that energy to grid and zero coge outputs.

This patches the XLSM in-place (keeping macros) so it can be re-exported later.

Usage:
    python data-pipeline/fix_coge_overproduction.py \
        --start-date 2024-11-18 \
        data V3/2024/coge\\ spento\\ 2024.xlsm [more files...]
"""

from __future__ import annotations

import argparse
import datetime as dt
import shutil
from pathlib import Path
from typing import Dict, List

from openpyxl import load_workbook


SHEET_NAME = "inserimento_consumi"

# Header labels used in V3 XLSM
COLUMN_MAP: Dict[str, str] = {
    "Data": "date",
    "EE acquistata [kWh]": "ee_acquistata_kwh",
    "EE prod coge [kWh]": "ee_prod_coge_kwh",
    "EE prod altro [kWh]": "ee_prod_altro_kwh",
    "AC prod coge [kWh]": "ac_prod_coge_kwh",
    "Vap prod coge [kWh]": "vap_prod_coge_kwh",
    "Frig prod coge [kWh]": "frig_prod_coge_kwh",
    "Gas consumato coge [smc]": "gas_consumato_coge_smc",
    "EE ceduta [kWh]": "ee_ceduta_kwh",
}

ZERO_OUT_FIELDS: List[str] = [
    "ee_prod_coge_kwh",
    "ac_prod_coge_kwh",
    "vap_prod_coge_kwh",
    "frig_prod_coge_kwh",
]


def parse_args():
    parser = argparse.ArgumentParser(description="Fix coge overproduction (gas=0, coge>0) by shifting to grid.")
    parser.add_argument("files", nargs="+", type=Path, help="XLSM files to patch")
    parser.add_argument("--start-date", type=str, default="2024-11-18", help="Start date (YYYY-MM-DD) for the fix window")
    return parser.parse_args()


def build_header_map(ws):
    header = {}
    for cell in ws[1]:
        if cell.value in COLUMN_MAP:
            header[COLUMN_MAP[cell.value]] = cell.column
    missing = [v for v in COLUMN_MAP.values() if v not in header]
    if missing:
        raise RuntimeError(f"Missing expected columns in {SHEET_NAME}: {missing}")
    return header


def to_number(val):
    if val is None:
        return 0
    try:
        return float(val)
    except Exception:
        return 0


def fix_file(path: Path, start_date: dt.date):
    backup = path.with_suffix(".bak.xlsm")
    if not backup.exists():
        shutil.copy(path, backup)

    wb = load_workbook(path, keep_vba=True)
    if SHEET_NAME not in wb.sheetnames:
        raise RuntimeError(f"Sheet '{SHEET_NAME}' not found in {path}")
    ws = wb[SHEET_NAME]

    header = build_header_map(ws)
    fixed_rows = 0
    moved_kwh = 0.0

    base_cell = ws["A2"].value
    if not isinstance(base_cell, dt.datetime):
        raise RuntimeError(f"Cell A2 does not contain a datetime start value in {path}")

    # Baseline: average grid per hour before the imputated window
    baseline = {h: [] for h in range(24)}
    for idx, row in enumerate(ws.iter_rows(min_row=2), start=0):
        date_val = base_cell + dt.timedelta(hours=idx)
        if date_val.date() < start_date:
            grid_val = to_number(row[header["ee_acquistata_kwh"] - 1].value)
            baseline[date_val.hour].append(grid_val)

    baseline_avg = {h: (sum(vals) / len(vals) if vals else 0) for h, vals in baseline.items()}

    for idx, row in enumerate(ws.iter_rows(min_row=2), start=0):
        date_val = base_cell + dt.timedelta(hours=idx)
        if date_val.date() < start_date:
            continue

        gas = to_number(row[header["gas_consumato_coge_smc"] - 1].value)
        coge = to_number(row[header["ee_prod_coge_kwh"] - 1].value)
        if gas == 0 and coge > 0:
            # Use historical hourly average as proxy for grid purchase
            new_grid = baseline_avg.get(date_val.hour, 0)

            grid_cell = row[header["ee_acquistata_kwh"] - 1]
            grid_cell.value = new_grid

            # Zero out coge production and related thermal outputs
            for key in ZERO_OUT_FIELDS:
                row[header[key] - 1].value = 0

            fixed_rows += 1
            moved_kwh += coge

    wb.save(path)
    print(f"[✓] Patched {path}: rows fixed {fixed_rows}, kWh moved {round(moved_kwh, 2)} (backup: {backup.name})")


def main():
    args = parse_args()
    start_date = dt.datetime.strptime(args.start_date, "%Y-%m-%d").date()
    for file_path in args.files:
        fix_file(file_path, start_date)


if __name__ == "__main__":
    main()
