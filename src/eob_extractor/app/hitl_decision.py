class HITLDecisionEngine:

    EXTRACTION_THRESHOLD = 0.80
    AUTO_MATCH_THRESHOLD = 85
    AMBIGUITY_GAP = 10

    @classmethod
    def should_match(cls, payload):

        document_confidence = payload.get(
            "document_confidence",
            0.0
        )

        if payload.get(
            "requires_human_review",
            False
        ):
            return {
                "can_match": False,
                "reason": "LLM requested review"
            }

        if document_confidence < cls.EXTRACTION_THRESHOLD:
            return {
                "can_match": False,
                "reason": (
                    f"Low document confidence "
                    f"({document_confidence})"
                )
            }

        return {
            "can_match": True,
            "reason": None
        }

    @classmethod
    def evaluate_match(
        cls,
        match_result
    ):

        reasons = []

        best_match = match_result.get(
            "best_match",
            {}
        )

        match_score = best_match.get(
            "score",
            0
        )

        candidates = match_result.get(
            "top_candidates",
            []
        )

        if match_score < cls.AUTO_MATCH_THRESHOLD:
            reasons.append(
                f"Low match score ({match_score})"
            )

        if len(candidates) > 1:

            top_score = candidates[0].get(
                "score",
                0
            )

            second_score = candidates[1].get(
                "score",
                0
            )

            if (
                abs(top_score - second_score)
                < cls.AMBIGUITY_GAP
            ):
                reasons.append(
                    "Multiple similar candidates"
                )

        return {
            "requires_human_review":
                len(reasons) > 0,
            "match_score": match_score,
            "reasons": reasons
        }