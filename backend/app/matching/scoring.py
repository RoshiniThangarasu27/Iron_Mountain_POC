import re
from datetime import date, datetime
from typing import Any

from rapidfuzz import fuzz

DATE_FORMATS = ("%m/%d/%y", "%m/%d/%Y", "%Y-%m-%d", "%Y%m%d", "%m-%d-%Y", "%m-%d-%y", "%m%d%y", "%m%d%Y")
IDENTIFIER_CLEANUP = re.compile(r"[^A-Z0-9]")


def to_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).replace("$", "").replace(",", "").strip())
    except ValueError:
        return None


def normalize_date(value: Any) -> date | None:
    if not value:
        return None
    text = str(value).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def normalize_identifier(value: Any) -> str:
    return IDENTIFIER_CLEANUP.sub("", str(value or "").upper())


def normalize_code(value: Any) -> str:
    return str(value or "").strip().upper().removeprefix("HC:")


class ClaimScorer:
    @staticmethod
    def exact_match(eob_value: Any, claim_value: Any) -> int:
        if not eob_value or not claim_value:
            return 0
        return 1 if str(eob_value).strip().lower() == str(claim_value).strip().lower() else 0

    @staticmethod
    def fuzzy_match(eob_value: Any, claim_value: Any) -> float:
        if not eob_value or not claim_value:
            return 0
        return fuzz.ratio(str(eob_value).lower(), str(claim_value).lower()) / 100

    @staticmethod
    def date_match(eob_value: Any, claim_value: Any) -> int:
        eob_date = normalize_date(eob_value)
        claim_date = normalize_date(claim_value)
        if eob_date is None or claim_date is None:
            return 0
        return 1 if eob_date == claim_date else 0

    @staticmethod
    def amount_match(eob_amount: Any, claim_amount: Any) -> float:
        eob_value = to_float(eob_amount)
        claim_value = to_float(claim_amount)
        if eob_value is None or claim_value is None:
            return 0
        difference = abs(eob_value - claim_value)
        if difference == 0:
            return 1.0
        if difference <= 1:
            return 0.8
        if difference <= 5:
            return 0.5
        return 0
