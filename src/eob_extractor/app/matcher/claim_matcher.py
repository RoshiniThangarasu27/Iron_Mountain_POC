from eob_extractor.app.matcher.constants import (
    MATCH_WEIGHTS,
    AUTO_MATCH_THRESHOLD,
    REVIEW_THRESHOLD
)

import re
from eob_extractor.app.matcher.scoring import ClaimScorer


class ClaimMatcher:

    def match(
        self,
        eob_claim: dict,
        repository_claims: list
    ):

        candidates = []

        for claim in repository_claims:

            candidate = self.score_claim(
                eob_claim,
                claim
            )

            candidates.append(candidate)

        candidates.sort(
            key=lambda x: x["score"],
            reverse=True
        )

        best_match = (
            candidates[0]
            if candidates
            else None
        )

        return {
            "best_match": best_match,
            "top_candidates": candidates[:1]
        }

    def score_claim(
        self,
        eob,
        claim
    ):

        total_score = 0

        matched_on = []

        details = {}

        # ------------------------
        # Patient Name
        # ------------------------

        patient_score = ClaimMatcher.patient_name_match(

        eob.get("patient_name"),

        claim.get("patient_name")

    )

        patient_points = (patient_score * MATCH_WEIGHTS["patient_name"] )
        total_score += patient_points

        if patient_points:
            matched_on.append("patient_name")

        details["patient_name"] = round(patient_points,2)
    
        # ------------------------
        # DOS
        # ------------------------

        dos_score_from = ClaimScorer.date_match(
        eob.get("date_of_service_from"),
        claim.get("date_of_service_from")
    )

        dos_score_to = ClaimScorer.date_match(
            eob.get("date_of_service_to"),
            claim.get("date_of_service_to")
        )

        dos_score = (
            dos_score_from + dos_score_to
        ) / 2

        dos_points = (
            dos_score *
            MATCH_WEIGHTS["date_of_service"]
        )

        total_score += dos_points

        if dos_points:
            matched_on.append(
                "date_of_service"
            )

        details["date_of_service"] = round(
            dos_points,
            2
        )

     # ------------------------
        # Service Code + Amount
        # ------------------------

        service_score = 0.0

        eob_service_code = eob.get("service_code")

        eob_amount = float(
            eob.get("billed_amount", 0)
        )

        for line in claim.get("service_lines", []):

            claim_service_code = line.get(
                "procedure_code"
            )

            claim_amount = float(
                line.get(
                    "line_charge_amount",
                    0
                )
            )

            if (
                claim_service_code == eob_service_code
                and claim_amount == eob_amount
            ):
                service_score = 1.0
                break

        # Award BOTH service_code and billed_amount points
        # only when the combination matches

        if service_score == 1.0:

            service_points = (
                MATCH_WEIGHTS["service_code"]
            )

            amount_points = (
                MATCH_WEIGHTS["billed_amount"]
            )

            total_score += (
                service_points + amount_points
            )

            matched_on.append(
                "service_code"
            )

            matched_on.append(
                "billed_amount"
            )

        else:

            service_points = 0
            amount_points = 0

        details["service_code"] = round(
            service_points,
            2
        )

        details["billed_amount"] = round(
            amount_points,
            2
        )
        # ------------------------
        # Provider
        # ------------------------

        provider_score = ClaimScorer.fuzzy_match(
            eob.get("provider_name"),
            claim.get("provider_name")
        )

        provider_points = (
            provider_score
            * MATCH_WEIGHTS["provider_name"]
        )

        total_score += provider_points

        if provider_points >= 4:
            matched_on.append(
                "provider_name"
            )

        details["provider_name"] = round(
            provider_points,
            2
        )

        MAX_SCORE = sum(MATCH_WEIGHTS.values())

        normalized_score = round(
            (total_score / MAX_SCORE) * 100,
            2
        )

        status = self.determine_status(
            normalized_score
        )

        return {
            "claim_id": claim.get(
                "claim_id"
            ),
            "score": round(
                normalized_score,
                2
            ),
            "status": status,
            "matched_on": matched_on,
            "score_breakdown": details
        }

    def determine_status(self, score):

        if score >= AUTO_MATCH_THRESHOLD:
            return "AUTO_MATCH"

        if score >= REVIEW_THRESHOLD:
            return "REVIEW"

        return "NO_MATCH"

   


    @staticmethod
    def normalize_name(name: str) -> str:

        if not name:
            return ""

        name = name.upper()

        # Remove punctuation
        name = re.sub(r"[,.]", "", name)

        # Split into words
        parts = name.split()

        # Ignore middle initials
        parts = [
            part
            for part in parts
            if len(part) > 1
        ]

        return " ".join(parts)

    @staticmethod
    def patient_name_match(
        eob_name: str,
        claim_name: str
    ) -> float:

        if not eob_name or not claim_name:
            return 0.0

        eob_tokens = set(
            ClaimMatcher.normalize_name(
                eob_name
            ).split()
        )

        claim_tokens = set(
            ClaimMatcher.normalize_name(
                claim_name
            ).split()
        )

        return (
            1.0
            if eob_tokens == claim_tokens
            else 0.0
        )