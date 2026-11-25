from typing import Any


def to_match_input(eob_claim: dict[str, Any]) -> dict[str, Any]:
    return {
        "patient_id": eob_claim.get("patient_id"),
        "claim_id": eob_claim.get("claim_id"),
        "patient_name": eob_claim.get("patient_name"),
        "date_of_service_from": eob_claim.get("date_of_service_from"),
        "date_of_service_to": eob_claim.get("date_of_service_to"),
        "service_code": eob_claim.get("service_code"),
        "billed_amount": eob_claim.get("billed_amount"),
        "paid_amount": eob_claim.get("paid_amount"),
        "provider_name": eob_claim.get("provider_name"),
    }


def claim_summary(claim: dict[str, Any]) -> dict[str, Any]:
    return {
        "claim_id": claim.get("claim_id"),
        "member_id": claim.get("member_id"),
        "patient_name": claim.get("patient_name"),
        "date_of_service_from": claim.get("date_of_service_from"),
        "date_of_service_to": claim.get("date_of_service_to"),
        "claim_amount": claim.get("claim_amount"),
        "provider_name": claim.get("provider_name"),
        "provider_npi": claim.get("provider_npi"),
        "service_lines": claim.get("service_lines") or [],
    }
