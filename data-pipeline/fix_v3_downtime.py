"""
For V3 dashboard data, force the downtime window (18 Nov 2024 → 10 Feb 2025) to:
- use costo_coge_spento as costo_attuale in recap files, recalculating derived fields;
- zero cogenerator production/consumption in consumi and shift that energy to grid purchase.

Applied to all scenarios (normal, fv12, normal350, fv12350) under apps/dashboard/data.

Usage:
    python data-pipeline/fix_v3_downtime.py

Use --dry-run to preview changes without writing files.
"""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Dict, Tuple

START = date(2024, 11, 18)
END = date(2025, 2, 10)

SCENARIOS = ("normal", "fv12", "normal350", "fv12350")
YEARS = ("2024", "2025")

BASE_DIR = Path("apps/dashboard/data")


def is_in_window(year: str, month: str, day: str) -> bool:
    current = date(int(year), int(month), int(day))
    return START <= current <= END


def load_json(path: Path) -> Dict:
    return json.loads(path.read_text())


def save_json(path: Path, data: Dict, dry_run: bool) -> None:
    if dry_run:
        return
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def recalc_recap_fields(rec: Dict) -> None:
    costs = [
        rec.get("costo_attuale", 0),
        rec.get("costo_coge_spento", 0),
        rec.get("costo_coge_minimo", 0),
        rec.get("costo_coge_ins_elettrico", 0),
        rec.get("costo_coge_ins_elettrico+", 0),
        rec.get("costo_coge_massimo", 0),
        rec.get("costo_coge_ins_termico", 0),
    ]
    minimo = min(costs)
    massimo = max(costs)
    rec["minimo"] = minimo
    rec["range_costi"] = massimo - minimo
    rec["risparmio_possibile"] = rec["costo_attuale"] - minimo
    rec["risparmio_spento"] = rec["costo_coge_spento"] - minimo
    rec["risparmio_minimo"] = rec["costo_coge_minimo"] - minimo
    rec["risparmio_ins_ele"] = rec["costo_coge_ins_elettrico"] - minimo
    rec["risparmio_ins_ele+"] = rec["costo_coge_ins_elettrico+"] - minimo
    rec["risparmio_massimo"] = rec["costo_coge_massimo"] - minimo
    rec["risparmio_ins_frigo"] = rec["costo_coge_ins_termico"] - minimo
    rec["risparmio_su_benchmark"] = massimo - minimo
    rec["risparmi"] = massimo - minimo


def fix_recap(path: Path, dry_run: bool) -> Tuple[int, int]:
    data = load_json(path)
    updated = 0
    total = 0

    for year, months in data.items():
        for month, days in months.items():
            for day, hours in days.items():
                if not is_in_window(year, month, day):
                    total += len(hours)
                    continue
                for hour, rec in hours.items():
                    total += 1
                    new_attuale = rec.get("costo_coge_spento")
                    if new_attuale is None:
                        continue
                    # Allinea il costo attuale a coge_spento nel fermo
                    rec["costo_attuale"] = new_attuale
                    recalc_recap_fields(rec)
                    updated += 1

    save_json(path, data, dry_run=dry_run)
    return updated, total


def fix_consumi(path: Path, dry_run: bool) -> Tuple[int, int]:
    data = load_json(path)
    updated = 0
    total = 0

    for year, months in data.items():
        for month, days in months.items():
            for day, hours in days.items():
                if not is_in_window(year, month, day):
                    total += len(hours)
                    continue
                for hour, rec in hours.items():
                    if not isinstance(rec, dict):
                        continue
                    total += 1
                    delta = rec.get("ee_prod_coge_kwh", 0) or 0
                    # Shift coge production to grid purchase
                    rec["ee_acquistata_kwh"] = (rec.get("ee_acquistata_kwh", 0) or 0) + delta
                    # Zero coge production/consumption
                    rec["ee_prod_coge_kwh"] = 0
                    rec["gas_consumato_coge_smc"] = 0
                    rec["ac_prod_coge_kwh"] = 0
                    rec["vap_prod_coge_kwh"] = 0
                    rec["frig_prod_coge_kwh"] = 0
                    updated += 1

    save_json(path, data, dry_run=dry_run)
    return updated, total


def main() -> None:
    parser = argparse.ArgumentParser(description="Fix V3 downtime costs and coge production (Nov 18 2024 - Feb 10 2025).")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing files.")
    args = parser.parse_args()

    total_recap = total_consumi = 0
    entries_recap = entries_consumi = 0

    for year in YEARS:
        for scen in SCENARIOS:
            base = BASE_DIR / year / scen
            recap_path = base / "recap_estratti.json"
            consumi_path = base / "inserimento_consumi_estratti.json"
            if recap_path.exists():
                upd, tot = fix_recap(recap_path, args.dry_run)
                total_recap += upd
                entries_recap += tot
                print(f"{'would update' if args.dry_run else 'updated':13s} {upd:6d} / {tot:6d} recap -> {recap_path}")
            else:
                print(f"⚠️ Missing recap: {recap_path}")
            if consumi_path.exists():
                upd, tot = fix_consumi(consumi_path, args.dry_run)
                total_consumi += upd
                entries_consumi += tot
                print(f"{'would update' if args.dry_run else 'updated':13s} {upd:6d} / {tot:6d} consumi -> {consumi_path}")
            else:
                print(f"⚠️ Missing consumi: {consumi_path}")

    print(f"\nSummary recap: {'no changes' if total_recap == 0 else f'updated {total_recap} entries'} out of {entries_recap}.")
    print(f"Summary consumi: {'no changes' if total_consumi == 0 else f'updated {total_consumi} entries'} out of {entries_consumi}.")


if __name__ == "__main__":
    main()
