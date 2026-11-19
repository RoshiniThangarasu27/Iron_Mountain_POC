"""Lightweight, forgiving inspector for X12 837 (health care claim) files.

WARNING: TEMPORARY, VIBE-CODED PLACEHOLDER. REPLACE BEFORE REAL USE.
=====================================================================
This parser was vibe-coded (AI-generated heuristics) to get the POC running.
It has NOT been checked against the X12 005010 837P/837I/837D implementation
guides, and it has only been tried on the synthetic files in ``samples/``.
Do not rely on its output for real claims processing.

It should be replaced with a proper AI-based parser.

What the current code does: it splits segments, pulls out envelope identifiers
and a few claim-level counts into a small JSON summary, and reports problems
as warnings instead of raising exceptions.
"""

from __future__ import annotations

from collections import Counter
from decimal import Decimal, InvalidOperation
from typing import Any

MAX_CLAIM_IDS = 25
ISA_FIXED_LENGTH = 106

IMPLEMENTATION_GUIDES = {
    "X222": "professional",
    "X223": "institutional",
    "X224": "dental",
}

HL_LEVEL_NAMES = {"20": "billing_provider", "22": "subscriber", "23": "patient"}

LOOP_MARKERS: list[tuple[str, int, str, str]] = [
    ("NM1", 1, "41", "1000A Submitter Name"),
    ("NM1", 1, "40", "1000B Receiver Name"),
    ("HL", 3, "20", "2000A Billing Provider Hierarchical Level"),
    ("NM1", 1, "85", "2010AA Billing Provider Name"),
    ("NM1", 1, "87", "2010AB Pay-To Address Name"),
    ("HL", 3, "22", "2000B Subscriber Hierarchical Level"),
    ("NM1", 1, "IL", "2010BA Subscriber Name"),
    ("NM1", 1, "PR", "2010BB Payer Name"),
    ("HL", 3, "23", "2000C Patient Hierarchical Level"),
    ("NM1", 1, "QC", "2010CA Patient Name"),
    ("CLM", 0, "", "2300 Claim Information"),
    ("NM1", 1, "82", "2310B Rendering Provider Name"),
    ("NM1", 1, "77", "2310C Service Facility Location"),
    ("SBR", 0, "", "2000B/2320 Subscriber / Other Subscriber Information"),
    ("LX", 0, "", "2400 Service Line Number"),
    ("SV1", 0, "", "2400 Professional Service (SV1)"),
    ("SV2", 0, "", "2400 Institutional Service (SV2)"),
    ("SV3", 0, "", "2400 Dental Service (SV3)"),
]


def decode_text(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("latin-1")


def _el(parts: list[str], idx: int) -> str | None:
    if idx < len(parts):
        value = parts[idx].strip()
        return value or None
    return None


def detect_delimiters(text: str) -> dict[str, str | None]:
    stripped = text.lstrip()
    element = "*"
    component: str | None = ":"
    repetition: str | None = None
    segment = "~"
    method = "heuristic"

    if stripped.startswith("ISA") and len(stripped) > 3:
        element = stripped[3]
        if len(stripped) >= ISA_FIXED_LENGTH:
            header = stripped[:ISA_FIXED_LENGTH]
            parts = header[: ISA_FIXED_LENGTH - 1].split(element)
            term = header[ISA_FIXED_LENGTH - 1]
            if len(parts) == 17 and not term.isalnum() and term != element:
                component = header[ISA_FIXED_LENGTH - 2]
                segment = term
                rep = _el(parts, 11)
                repetition = rep if rep and len(rep) == 1 and not rep.isalnum() else None
                method = "isa_fixed_width"
    else:
        candidates = {c: text.count(c) for c in ("*", "|", "^")}
        best = max(candidates, key=lambda c: candidates[c])
        if candidates[best] > 0:
            element = best

    if method == "heuristic":
        segment = "~" if "~" in text else "\n"
        first = stripped.split(segment, 1)[0]
        if first.startswith("ISA"):
            parts = first.split(element)
            comp = _el(parts, 16)
            component = comp[0] if comp else component
            rep = _el(parts, 11)
            repetition = rep if rep and len(rep) == 1 and not rep.isalnum() else None

    return {
        "element": element,
        "component": component,
        "repetition": repetition,
        "segment": segment,
        "method": method,
    }


def split_segments(text: str, delimiters: dict[str, str | None]) -> list[list[str]]:
    terminator = delimiters["segment"] or "~"
    element = delimiters["element"] or "*"
    segments: list[list[str]] = []
    for raw in text.split(terminator):
        seg = raw.strip().strip("\r\n")
        if not seg:
            continue
        parts = seg.split(element)
        parts[0] = parts[0].strip().upper()
        segments.append(parts)
    return segments


def parse_837(data: bytes) -> tuple[str, dict[str, Any]]:
    warnings: list[str] = []
    text = decode_text(data)

    if not text.strip():
        return "failed", {"is_x12": False, "segment_count": 0, "warnings": ["File contains no text"]}

    delimiters = detect_delimiters(text)
    segments = split_segments(text, delimiters)
    segment_ids = [s[0] for s in segments]
    counts = Counter(segment_ids)

    def first(seg_id: str) -> list[str] | None:
        return next((s for s in segments if s[0] == seg_id), None)

    isa, gs, st, bht, se = first("ISA"), first("GS"), first("ST"), first("BHT"), first("SE")

    summary: dict[str, Any] = {
        "parser_version": 1,
        "delimiters": delimiters,
        "segment_count": len(segments),
        "segment_counts": dict(counts.most_common()),
    }

    if isa:
        summary["interchange"] = {
            "sender_qualifier": _el(isa, 5),
            "sender_id": _el(isa, 6),
            "receiver_qualifier": _el(isa, 7),
            "receiver_id": _el(isa, 8),
            "date": _el(isa, 9),
            "time": _el(isa, 10),
            "version": _el(isa, 12),
            "control_number": _el(isa, 13),
            "usage_indicator": _el(isa, 15),
        }
    else:
        warnings.append("No ISA interchange header found")

    if gs:
        summary["functional_group"] = {
            "functional_id": _el(gs, 1),
            "sender_code": _el(gs, 2),
            "receiver_code": _el(gs, 3),
            "date": _el(gs, 4),
            "time": _el(gs, 5),
            "control_number": _el(gs, 6),
            "version": _el(gs, 8),
        }
        if _el(gs, 1) and _el(gs, 1) != "HC":
            warnings.append(f"GS01 is '{_el(gs, 1)}', expected 'HC' for an 837 claim group")
    else:
        warnings.append("No GS functional group header found")

    if st:
        summary["transaction_set"] = {
            "id": _el(st, 1),
            "control_number": _el(st, 2),
            "implementation_reference": _el(st, 3),
        }
        if _el(st, 1) and _el(st, 1) != "837":
            warnings.append(f"ST01 is '{_el(st, 1)}', expected '837'")
    else:
        warnings.append("No ST transaction set header found")

    if bht:
        summary["beginning_of_transaction"] = {
            "structure_code": _el(bht, 1),
            "purpose_code": _el(bht, 2),
            "reference_id": _el(bht, 3),
            "date": _el(bht, 4),
            "time": _el(bht, 5),
            "transaction_type_code": _el(bht, 6),
        }

    version_ref = (st and _el(st, 3)) or (gs and _el(gs, 8)) or ""
    summary["claim_type"] = next(
        (name for key, name in IMPLEMENTATION_GUIDES.items() if key in version_ref.upper()), None
    )

    claims = [s for s in segments if s[0] == "CLM"]
    total = Decimal("0")
    total_valid = bool(claims)
    for clm in claims:
        try:
            total += Decimal(_el(clm, 2) or "")
        except InvalidOperation:
            total_valid = False
    summary["claim_count"] = len(claims)
    summary["claim_ids"] = [cid for c in claims[:MAX_CLAIM_IDS] if (cid := _el(c, 1))]
    summary["total_claim_charges"] = str(total) if total_valid else None
    summary["service_line_count"] = counts.get("LX", 0)

    hl_levels: Counter[str] = Counter()
    for hl in (s for s in segments if s[0] == "HL"):
        code = _el(hl, 3)
        hl_levels[HL_LEVEL_NAMES.get(code or "", code or "unknown")] += 1
    summary["hierarchical_levels"] = dict(hl_levels)

    detected: list[str] = []
    for seg_id, idx, qualifier, loop in LOOP_MARKERS:
        if any(s[0] == seg_id and (not qualifier or _el(s, idx) == qualifier) for s in segments):
            detected.append(loop)
    summary["detected_loops"] = detected

    summary["envelope"] = {
        "has_isa": "ISA" in counts,
        "has_iea": "IEA" in counts,
        "has_gs": "GS" in counts,
        "has_ge": "GE" in counts,
        "has_st": "ST" in counts,
        "has_se": "SE" in counts,
    }
    for open_id, close_id in (("ISA", "IEA"), ("GS", "GE"), ("ST", "SE")):
        if counts.get(open_id, 0) != counts.get(close_id, 0):
            warnings.append(
                f"Unbalanced envelope: {counts.get(open_id, 0)} {open_id} vs {counts.get(close_id, 0)} {close_id}"
            )

    if st and se:
        try:
            st_idx = next(i for i, s in enumerate(segments) if s[0] == "ST")
            se_idx = next(i for i, s in enumerate(segments) if s[0] == "SE" and i > st_idx)
            actual = se_idx - st_idx + 1
            reported = int(_el(se, 1) or "")
            summary["transaction_set"]["reported_segment_count"] = reported
            summary["transaction_set"]["actual_segment_count"] = actual
            if reported != actual:
                warnings.append(f"SE01 reports {reported} segments but {actual} were found between ST and SE")
        except (StopIteration, ValueError):
            warnings.append("Could not verify SE01 segment count")

    known = {"ISA", "GS", "ST", "BHT", "CLM", "NM1", "HL", "SBR", "LX"}
    is_x12 = bool(known & set(counts))
    summary["is_x12"] = is_x12
    if not is_x12:
        warnings.append("No recognizable X12 segments found; file may not be an EDI 837")
    elif claims == []:
        warnings.append("No CLM (claim) segments found")

    summary["warnings"] = warnings
    return ("parsed" if is_x12 else "failed"), summary
