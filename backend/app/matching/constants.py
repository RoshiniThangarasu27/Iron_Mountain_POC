MATCH_WEIGHTS = {
    "patient_name": 20,
    "date_of_service": 15,
    "service_code": 10,
    "billed_amount": 10,
    "provider_name": 5,
}

MAX_SCORE = sum(MATCH_WEIGHTS.values())

AUTO_MATCH_THRESHOLD = 85
REVIEW_THRESHOLD = 60
AMBIGUITY_GAP = 10
TOP_CANDIDATES = 3
PROVIDER_MATCHED_ON_MIN_POINTS = 4

AUTO_MATCH = "AUTO_MATCH"
REVIEW = "REVIEW"
NO_MATCH = "NO_MATCH"
