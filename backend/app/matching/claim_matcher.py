import re
from typing import Any

from app.matching.constants import (
    AUTO_MATCH,
    AUTO_MATCH_THRESHOLD,
    MATCH_WEIGHTS,
    MAX_SCORE,
    NO_MATCH,
    PROVIDER_MATCHED_ON_MIN_POINTS,
    REVIEW,
    REVIEW_THRESHOLD,
    TOP_CANDIDATES,
)
from app.matching.mapper import claim_summary
from app.matching.scoring import ClaimScorer, normalize_code, normalize_identifier

IDENTIFIER_FIELDS = (("claim_id", "claim_id", "Claim ID"), ("patient_id", "member_id", "Member ID"))


class ClaimMatcher:
    def match(self, eob_claim: dict[str, Any], repository_claims: list[dict[str, Any]]) -> dict[str, Any]:
        candidates = [self.score_claim(eob_claim, claim) for claim in repository_claims]
        candidates.sort(
            key=lambda c: (c["score"], len(c["identifier_matches"]), -len(c["identifier_conflicts"])),
            reverse=True,
        )
        return {
            "best_match": candidates[0] if candidates else None,
            "top_candidates": candidates[:TOP_CANDIDATES],
        }

    def score_claim(self, eob: dict[str, Any], claim: dict[str, Any]) -> dict[str, Any]:
        total_score = 0.0
        matched_on: list[str] = []
        details: dict[str, float] = {}

        patient_points = (
            self.patient_name_match(eob.get("patient_name"), claim.get("patient_name")) * MATCH_WEIGHTS["patient_name"]
        )
        total_score += patient_points
        if patient_points:
            matched_on.append("patient_name")
        details["patient_name"] = round(patient_points, 2)

        dos_score = (
            ClaimScorer.date_match(eob.get("date_of_service_from"), claim.get("date_of_service_from"))
            + ClaimScorer.date_match(eob.get("date_of_service_to"), claim.get("date_of_service_to"))
        ) / 2
        dos_points = dos_score * MATCH_WEIGHTS["date_of_service"]
        total_score += dos_points
        if dos_points:
            matched_on.append("date_of_service")
        details["date_of_service"] = round(dos_points, 2)

        eob_code = normalize_code(eob.get("service_code"))
        amount_score = 0.0
        if eob_code:
            for line in claim.get("service_lines") or []:
                if normalize_code(line.get("procedure_code")) == eob_code:
                    amount_score = max(
                        amount_score, ClaimScorer.amount_match(eob.get("billed_amount"), line.get("line_charge_amount"))
                    )

        service_points = amount_points = 0.0
        if amount_score > 0:
            service_points = MATCH_WEIGHTS["service_code"]
            amount_points = MATCH_WEIGHTS["billed_amount"] * amount_score
            total_score += service_points + amount_points
            matched_on += ["service_code", "billed_amount"]
        details["service_code"] = round(service_points, 2)
        details["billed_amount"] = round(amount_points, 2)

        provider_points = (
            ClaimScorer.fuzzy_match(eob.get("provider_name"), claim.get("provider_name"))
            * MATCH_WEIGHTS["provider_name"]
        )
        total_score += provider_points
        if provider_points >= PROVIDER_MATCHED_ON_MIN_POINTS:
            matched_on.append("provider_name")
        details["provider_name"] = round(provider_points, 2)

        identifier_matches, identifier_conflicts = self.identifier_check(eob, claim)
        normalized_score = round((total_score / MAX_SCORE) * 100, 2)
        status = self.determine_status(normalized_score)
        if status == AUTO_MATCH and identifier_conflicts:
            status = REVIEW

        return {
            "document_id": claim.get("document_id"),
            "filename": claim.get("filename"),
            "claim_id": claim.get("claim_id"),
            "score": normalized_score,
            "status": status,
            "matched_on": matched_on + [field for field, _ in identifier_matches],
            "score_breakdown": details,
            "identifier_matches": [label for _, label in identifier_matches],
            "identifier_conflicts": identifier_conflicts,
            "claim": claim_summary(claim),
        }

    @staticmethod
    def identifier_check(eob: dict[str, Any], claim: dict[str, Any]) -> tuple[list[tuple[str, str]], list[dict]]:
        matches: list[tuple[str, str]] = []
        conflicts: list[dict] = []
        for eob_field, claim_field, label in IDENTIFIER_FIELDS:
            eob_value = normalize_identifier(eob.get(eob_field))
            claim_value = normalize_identifier(claim.get(claim_field))
            if not eob_value or not claim_value:
                continue
            if eob_value == claim_value:
                matches.append((claim_field, label))
            else:
                conflicts.append(
                    {"field": claim_field, "label": label, "eob": eob.get(eob_field), "claim": claim.get(claim_field)}
                )
        return matches, conflicts

    @staticmethod
    def determine_status(score: float) -> str:
        if score >= AUTO_MATCH_THRESHOLD:
            return AUTO_MATCH
        if score >= REVIEW_THRESHOLD:
            return REVIEW
        return NO_MATCH

    @staticmethod
    def normalize_name(name: str | None) -> str:
        if not name:
            return ""
        name = re.sub(r"[,.]", "", str(name).upper())
        return " ".join(part for part in name.split() if len(part) > 1)

    @staticmethod
    def patient_name_match(eob_name: str | None, claim_name: str | None) -> float:
        if not eob_name or not claim_name:
            return 0.0
        eob_tokens = set(ClaimMatcher.normalize_name(eob_name).split())
        claim_tokens = set(ClaimMatcher.normalize_name(claim_name).split())
        return 1.0 if eob_tokens and eob_tokens == claim_tokens else 0.0
