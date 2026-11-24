import json
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.extractors.errors import ExtractionError

MAPPING_PATH = Path(__file__).with_name("mapping.json")
SERVICE_LINE_FIELDS = {"procedure_code", "line_charge_amount", "units"}


@lru_cache
def load_mapping() -> dict[str, dict[str, Any]]:
    return json.loads(MAPPING_PATH.read_text(encoding="utf-8"))


def format_edi_date(date_str: str) -> str:
    try:
        return datetime.strptime(date_str, "%Y%m%d").strftime("%m/%d/%y")
    except ValueError:
        return date_str


def parse_837(edi_text: str) -> dict[str, Any]:
    mapping = load_mapping()
    claim: dict[str, Any] = {"service_lines": []}

    for raw_segment in edi_text.split("~"):
        segment = raw_segment.strip()
        if not segment:
            continue

        fields = segment.split("*")
        segment_name = fields[0]

        for field_name, config in mapping.items():
            if config["segment"] != segment_name or field_name in SERVICE_LINE_FIELDS:
                continue

            qualifier = config.get("qualifier")
            if qualifier and (len(fields) < 2 or fields[1] != qualifier):
                continue

            position = config["element"]
            if len(fields) <= position:
                continue

            value = fields[position]
            if "remove_prefix" in config:
                value = value.replace(config["remove_prefix"], "")

            if field_name == "date_of_service":
                claim["date_of_service"] = value
                if "-" in value:
                    dos_from, dos_to = value.split("-", 1)
                    claim["date_of_service_from"] = format_edi_date(dos_from)
                    claim["date_of_service_to"] = format_edi_date(dos_to)
                else:
                    formatted = format_edi_date(value)
                    claim["date_of_service_from"] = formatted
                    claim["date_of_service_to"] = formatted
            else:
                claim[field_name] = value

        if segment_name == "SV1":
            service_line: dict[str, str] = {}
            if len(fields) > 1:
                service_line["procedure_code"] = fields[1].removeprefix("HC:")
            if len(fields) > 2:
                service_line["line_charge_amount"] = fields[2]
            if len(fields) > 4:
                service_line["units"] = fields[4]
            claim["service_lines"].append(service_line)

    first_name = claim.get("patient_first_name", "")
    last_name = claim.get("patient_last_name", "")
    claim["patient_name"] = f"{first_name} {last_name}".strip()
    return claim


def decode_edi(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("latin-1")


def extract_claim(data: bytes) -> dict[str, Any]:
    text = decode_edi(data)
    if not text.strip():
        raise ExtractionError("File is empty")
    claim = parse_837(text)
    if "claim_id" not in claim:
        raise ExtractionError("No CLM segment found; this does not look like an 837 claim")
    return claim
