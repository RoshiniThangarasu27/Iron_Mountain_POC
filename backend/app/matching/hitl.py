from typing import Any

from app.matching.constants import AMBIGUITY_GAP, AUTO_MATCH_THRESHOLD, REVIEW_THRESHOLD


def evaluate_match(match_result: dict[str, Any]) -> dict[str, Any]:
    reasons: list[str] = []
    best_match = match_result.get("best_match") or {}
    candidates = match_result.get("top_candidates") or []
    match_score = best_match.get("score", 0)

    if not best_match:
        reasons.append("No extracted 837 claims available to match against")
    elif match_score < AUTO_MATCH_THRESHOLD:
        reasons.append(f"Low match score ({match_score})")

    if len(candidates) > 1 and match_score >= REVIEW_THRESHOLD:
        top_score = candidates[0].get("score", 0)
        second_score = candidates[1].get("score", 0)
        if abs(top_score - second_score) < AMBIGUITY_GAP:
            reasons.append("Multiple similar candidates")

    return {"requires_human_review": bool(reasons), "match_score": match_score, "reasons": reasons}
