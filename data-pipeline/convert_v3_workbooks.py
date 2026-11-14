"""
Convert the XLSM workbooks into the JSON structure consumed by the dashboard.

Usage:
    python data-pipeline/convert_v3_workbooks.py [--years 2024 2025] [--source v3|v4]

Outputs are written to:
- data-pipeline[-v4]/<year>/<scenario>/inserimento_consumi_estratti_<year>.json
- data-pipeline[-v4]/<year>/<scenario>/inserimento_prezzi_estratti_<year>.json
- data-pipeline[-v4]/<year>/<scenario>/elaborazione_consumi_estratti_<year>.json
- data-pipeline[-v4]/<year>/<scenario>/recap_estratti_<year>.json
and copied into apps/dashboard/data[_v4]/<year>/<scenario>/ with the legacy names
(without the year suffix) used by the frontend.

Scenarios:
- normal     -> coge spento
- fv12       -> FV12 coge spento
- normal350  -> 350 coge spento
- fv12350    -> 350 FV12 coge spento
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, Mapping

import pandas as pd


ROOT = Path(__file__).resolve().parent.parent
PIPELINE_OUT = ROOT / "data-pipeline"
DASHBOARD_OUT = ROOT / "apps" / "dashboard" / "data"


V3_WORKBOOKS: Mapping[int, Mapping[str, Path]] = {
    2024: {
        "normal": Path("data V3/2024/coge spento 2024.xlsm"),
        "fv12": Path("data V3/2024/fv12__coge spento 2024.xlsm"),
        "normal350": Path("data V3/2024/350_coge spento 2024.xlsm"),
        "fv12350": Path("data V3/2024/350_fv12__coge spento 2024.xlsm"),
    },
    2025: {
        "normal": Path("data V3/2025/NORMAL_Coge spento weekend 2025.xlsm"),
        "fv12": Path("data V3/2025/fv12_NORMAL_Coge spento weekend 2025.xlsm"),
        "normal350": Path("data V3/2025/350_NORMAL_Coge spento weekend 2025.xlsm"),
        "fv12350": Path("data V3/2025/350_fv12_NORMAL_Coge spento weekend 2025.xlsm"),
    },
}

V4_WORKBOOKS: Mapping[int, Mapping[str, Path]] = {
    2024: {
        "normal": Path("data V4/2024/coge spento 2024.xlsm"),
        "fv12": Path("data V4/2024/fv12__coge spento 2024.xlsm"),
        "normal350": Path("data V4/2024/350_coge spento 2024.xlsm"),
        "fv12350": Path("data V4/2024/350_fv12__coge spento 2024.xlsm"),
    },
    2025: {
        "normal": Path("data V4/2025/NORMAL_Coge spento weekend 2025.xlsm"),
        "fv12": Path("data V4/2025/fv12_NORMAL_Coge spento weekend 2025.xlsm"),
        # Nei V4 2025 i file 350 hanno nomenclatura senza underscore e con spazio finale nel fv12
        "normal350": Path("data V4/2025/350NORMAL_Coge spento weekend 2025.xlsm"),
        "fv12350": Path("data V4/2025/350fv12_NORMAL_Coge spento weekend 2025 .xlsm"),
    },
}

CONSUMI_COLUMNS = {
    "EE acquistata [kWh]": "ee_acquistata_kwh",
    "EE ceduta [kWh]": "ee_ceduta_kwh",
    "EE prod coge [kWh]": "ee_prod_coge_kwh",
    "EE prod altro [kWh]": "ee_prod_altro_kwh",
    "AC prod coge [kWh]": "ac_prod_coge_kwh",
    "Vap prod coge [kWh]": "vap_prod_coge_kwh",
    "AC prod caldaie [kWh]": "ac_prod_caldaie_kwh",
    "Gas consumato coge [smc]": "gas_consumato_coge_smc",
    "Gas consumato caldaie [smc]": "gas_consumato_caldaie_smc",
    "Frig prod coge [kWh]": "frig_prod_coge_kwh",
    "Frig prod chillers [kWh]": "frig_prod_chillers_kwh",
    "EE cons chillers [kWh]": "ee_cons_chillers_kwh",
    "EER Chiller": "eer_chiller",
}

PREZZI_COLUMNS = {
    "PSV": "psv",
    "TTF": "ttf",
    "PUN": "pun",
    "PNO": "pno",
    "Prezzo acquisto EE [€/MWh]": "prezzo_acquisto_ee_eur_mwh",
    "Prezzo vendita EE [€/MWh]": "prezzo_vendita_ee_eur_mwh",
    "Prezzo acquisto GAS [€/MWh]": "prezzo_acquisto_gas_eur_mwh",
}

ELABORAZIONE_COLUMNS = {
    "Fabbisogno EE azienda [kWh]": "fabbisogno_ee_azienda_kwh",
    "Fabbisogno AC Azienda [kWh]": "fabbisogno_ac_azienda_kwh",
}

RECAP_COLUMNS = {
    "Costo attuale": "costo_attuale",
    "Costo coge spento": "costo_coge_spento",
    "Costo coge minimo": "costo_coge_minimo",
    "Costo coge ins. elettrico": "costo_coge_ins_elettrico",
    "Costo coge ins. Elettrico+": "costo_coge_ins_elettrico+",
    "Costo coge massimo": "costo_coge_massimo",
    "Costo coge ins. Termico": "costo_coge_ins_termico",
    "Range costi": "range_costi",
    "Minimo": "minimo",
    "Forza spento": "forza_spento",
    "Risparmio possibile": "risparmio_possibile",
    "Minimo att": "minimo_att",
    "Minimo spento": "minimo_spento",
    "Minimo minimo": "minimo_minimo",
    "Minimo Ins ele": "minimo_ins_ele",
    "Minimo ins ele+": "minimo_ins_ele+",
    "minimo Massimo": "minimo_massimo",
    "Minimo Ins frigo": "minimo_ins_frigo",
    "Risparmio spento": "risparmio_spento",
    "Risparmio minimo": "risparmio_minimo",
    "Risparmio Ins ele": "risparmio_ins_ele",
    "Risparmio Ins ele+": "risparmio_ins_ele+",
    "Risparmio Massimo": "risparmio_massimo",
    "Risparmio ins frigo": "risparmio_ins_frigo",
    "Risparmio su benchmark": "risparmio_su_benchmark",
    "Risparmi": "risparmi",
}


def to_number(value):
    """Convert Excel values to plain Python numbers, fill NaN with 0."""
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        if pd.isna(value):
            return 0
        if isinstance(value, float) and value.is_integer():
            return int(value)
        return float(value)
    if pd.isna(value):
        return 0
    return value


def should_skip_date(dt: pd.Timestamp) -> bool:
    """Skip extra rows beyond Dec 30 of the target year (avoid 31/12 overflow)."""
    return dt.month == 12 and dt.day >= 31


def insert_payload(tree: Dict, year: str, month: str, day: str, hour: str, payload: Dict):
    tree.setdefault(year, {}).setdefault(month, {}).setdefault(day, {})[hour] = payload


def load_sheet(workbook: Path, sheet_name: str) -> pd.DataFrame:
    df = pd.read_excel(workbook, sheet_name=sheet_name)
    # In V3 files, only the first row in "Data" contains a concrete datetime,
    # the rest are formulas (=A2+1/24) which pandas reads as NaT. Rebuild
    # the full hourly timeline starting from the first valid datetime.
    if "Data" in df.columns:
        first_dt = next((v for v in df["Data"].tolist() if pd.notna(v)), None)
        if first_dt is not None:
            base = pd.to_datetime(first_dt)
            df["Data"] = [base + pd.Timedelta(hours=i) for i in range(len(df))]
        else:
            df = df.dropna(subset=["Data"])
    return df


def build_consumi(df: pd.DataFrame) -> Dict:
    data: Dict = {}
    for _, row in df.iterrows():
        dt = pd.to_datetime(row["Data"])
        if should_skip_date(dt):
            continue
        payload = {out_key: to_number(row.get(col_name)) for col_name, out_key in CONSUMI_COLUMNS.items()}
        insert_payload(data, str(dt.year), f"{dt.month:02d}", f"{dt.day:02d}", f"{dt.hour:02d}", payload)
    return data


def build_prezzi(df: pd.DataFrame) -> Dict:
    data: Dict = {}
    for _, row in df.iterrows():
        dt = pd.to_datetime(row["Data"])
        if should_skip_date(dt):
            continue
        mese_val = to_number(row.get("Mese", dt.month))
        mese = int(mese_val) if mese_val else dt.month
        payload = {"mese": mese}
        payload.update({out_key: to_number(row.get(col_name)) for col_name, out_key in PREZZI_COLUMNS.items()})
        # Fallback: se i prezzi EE/Gas sono zero/NaN, usa PUN/PSV come base
        if not payload["prezzo_acquisto_ee_eur_mwh"]:
            payload["prezzo_acquisto_ee_eur_mwh"] = payload.get("pun") or payload.get("pno") or 0
        if not payload["prezzo_vendita_ee_eur_mwh"]:
            payload["prezzo_vendita_ee_eur_mwh"] = payload.get("pno") or payload.get("pun") or 0
        if not payload["prezzo_acquisto_gas_eur_mwh"]:
            payload["prezzo_acquisto_gas_eur_mwh"] = payload.get("psv") or payload.get("ttf") or 0
        insert_payload(data, str(dt.year), f"{dt.month:02d}", f"{dt.day:02d}", f"{dt.hour:02d}", payload)
    return data


def build_elaborazione(df: pd.DataFrame, fallback_consumi: pd.DataFrame | None = None) -> Dict:
    data: Dict = {}
    # Primary: use the _elaborazione_consumi sheet if it contains data
    if df is not None and not df.empty and df["Data"].notna().any():
        for _, row in df.iterrows():
            dt = pd.to_datetime(row["Data"])
            if should_skip_date(dt):
                continue
            payload = {out_key: to_number(row.get(col_name)) for col_name, out_key in ELABORAZIONE_COLUMNS.items()}
            insert_payload(data, str(dt.year), f"{dt.month:02d}", f"{dt.day:02d}", f"{dt.hour:02d}", payload)
        if data:
            return data

    # Fallback: compute fabbisogno directly dai consumi (ee_acq + ee_prod_coge + ee_prod_altro - ee_ceduta)
    if fallback_consumi is not None and not fallback_consumi.empty:
        for _, row in fallback_consumi.iterrows():
            dt = pd.to_datetime(row["Data"])
            if should_skip_date(dt):
                continue
            fab_ee = (
                to_number(row.get("EE acquistata [kWh]"))
                + to_number(row.get("EE prod coge [kWh]"))
                + to_number(row.get("EE prod altro [kWh]"))
                - to_number(row.get("EE ceduta [kWh]"))
            )
            fab_ac = (
                to_number(row.get("AC prod coge [kWh]"))
                + to_number(row.get("AC prod caldaie [kWh]"))
            )
            payload = {
                "fabbisogno_ee_azienda_kwh": fab_ee,
                "fabbisogno_ac_azienda_kwh": fab_ac,
            }
            insert_payload(data, str(dt.year), f"{dt.month:02d}", f"{dt.day:02d}", f"{dt.hour:02d}", payload)
    return data


def build_recap(df: pd.DataFrame, fallback_consumi: pd.DataFrame | None = None, fallback_prezzi: pd.DataFrame | None = None) -> Dict:
    data: Dict = {}
    if df is not None and not df.empty and df["Data"].notna().any():
        for _, row in df.iterrows():
            dt = pd.to_datetime(row["Data"])
            payload = {"mese": int(row.get("Mese", dt.month) or dt.month)}
            payload.update({out_key: to_number(row.get(col_name)) for col_name, out_key in RECAP_COLUMNS.items()})
            insert_payload(data, str(dt.year), f"{dt.month:02d}", f"{dt.day:02d}", f"{dt.hour:02d}", payload)
        if data:
            return data

    # Fallback: stima costi base usando prezzo acquisto EE e EE acquistata
    if fallback_consumi is not None and fallback_prezzi is not None:
        for idx, row in fallback_consumi.iterrows():
            dt = pd.to_datetime(row["Data"])
            if should_skip_date(dt):
                continue
            if fallback_prezzi.empty:
                prezzo = 0
            else:
                pr = fallback_prezzi.iloc[idx % len(fallback_prezzi)]
                prezzo = to_number(pr.get("Prezzo acquisto EE [€/MWh]"))
                if prezzo == 0:
                    prezzo = to_number(pr.get("PUN")) or to_number(pr.get("PNO"))
            ee_acq = to_number(row.get("EE acquistata [kWh]"))
            costo = (ee_acq * prezzo) / 1000.0  # €/MWh -> kWh
            payload = {"mese": dt.month}
            # Appiattiamo tutte le strategie allo stesso costo; risparmi = 0
            for out_key in RECAP_COLUMNS.values():
                if out_key == "risparmi" or out_key.startswith("risparmio"):
                    payload[out_key] = 0
                elif out_key == "minimo":
                    payload[out_key] = costo
                else:
                    payload[out_key] = costo
            insert_payload(data, str(dt.year), f"{dt.month:02d}", f"{dt.day:02d}", f"{dt.hour:02d}", payload)
    return data


def write_json(path: Path, payload: Dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def process_workbook(year: int, scenario: str, workbook: Path, pipeline_base: Path, dash_base: Path):
    if not workbook.exists():
        raise FileNotFoundError(f"Workbook not found: {workbook}")

    consumi_df = load_sheet(workbook, "inserimento_consumi")
    prezzi_df = load_sheet(workbook, "inserimento_prezzi")
    elaborazione_df = load_sheet(workbook, "_elaborazione_consumi")
    recap_df = load_sheet(workbook, "recap_costi")

    consumi = build_consumi(consumi_df)
    prezzi = build_prezzi(prezzi_df)
    elaborazione = build_elaborazione(elaborazione_df, fallback_consumi=consumi_df)
    recap = build_recap(recap_df, fallback_consumi=consumi_df, fallback_prezzi=prezzi_df)

    pipeline_target = pipeline_base / str(year) / scenario
    dash_target = dash_base / str(year) / scenario

    write_json(pipeline_target / f"inserimento_consumi_estratti_{year}.json", consumi)
    write_json(pipeline_target / f"inserimento_prezzi_estratti_{year}.json", prezzi)
    write_json(pipeline_target / f"elaborazione_consumi_estratti_{year}.json", elaborazione)
    write_json(pipeline_target / f"recap_estratti_{year}.json", recap)

    # Legacy names used by the site.
    write_json(dash_target / "inserimento_consumi_estratti.json", consumi)
    write_json(dash_target / "inserimento_prezzi_estratti.json", prezzi)
    write_json(dash_target / "elaborazione_consumi_estratti.json", elaborazione)
    write_json(dash_target / "recap_estratti.json", recap)

    print(f"[✓] {year} {scenario} -> generated JSONs from {workbook}")


def main():
    parser = argparse.ArgumentParser(description="Convert XLSM workbooks (V3 or V4) to dashboard JSON.")
    parser.add_argument("--years", nargs="+", type=int, default=[2024, 2025], help="Years to process (default: 2024 2025).")
    parser.add_argument(
        "--source",
        choices=["v3", "v4"],
        default="v3",
        help="Workbook source version: v3 (default) or v4.",
    )
    args = parser.parse_args()

    source_map = {"v3": V3_WORKBOOKS, "v4": V4_WORKBOOKS}[args.source]
    pipeline_base = PIPELINE_OUT if args.source == "v3" else ROOT / "data-pipeline-v4"
    dash_base = DASHBOARD_OUT if args.source == "v3" else ROOT / "apps" / "dashboard" / "data_v4"

    for year in args.years:
        scenarios = source_map.get(year, {})
        if not scenarios:
            print(f"[!] No workbooks configured for year {year}")
            continue
        for scenario, workbook in scenarios.items():
            process_workbook(year, scenario, ROOT / workbook, pipeline_base, dash_base)


if __name__ == "__main__":
    main()
