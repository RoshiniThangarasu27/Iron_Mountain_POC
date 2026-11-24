from dataclasses import dataclass


@dataclass
class MatchCandidate:
    claim_id: str
    score: float
    status: str
    matched_on: list