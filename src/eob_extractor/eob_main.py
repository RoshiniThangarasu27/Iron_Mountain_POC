from pathlib import Path
import json

from eob_extractor.app.orchestrator import EOBParser
from eob_extractor.app.normalizer import Normalizer

from claim_extractor.app.repository import ClaimRepository

from eob_extractor.app.matcher.claim_matcher import ClaimMatcher
from eob_extractor.app.matcher.mapper import EOBMatchMapper

from eob_extractor.app.hitl_decision import (
    HITLDecisionEngine
)

# --------------------------------------------------
# Extract EOB
# --------------------------------------------------

prompt = Path(
    "src/eob_extractor/app/prompts/extraction_prompt.txt"
).read_text()

parser = EOBParser()

payload = parser.parse(prompt)

payload = Normalizer().normalize(payload)

if isinstance(payload, str):
    payload = json.loads(payload)

print("\nNORMALIZED PAYLOAD")
print(json.dumps(payload, indent=2))

# --------------------------------------------------
# Extraction Gate
# --------------------------------------------------

match_decision = (
    HITLDecisionEngine.should_match(
        payload
    )
)

if not match_decision["can_match"]:

    print("\n" + "=" * 100)

    print("\nMATCHING SKIPPED")

    print(
        json.dumps(
            {
                "requires_human_review": True,
                "stage": "EXTRACTION",
                "reason": match_decision["reason"]
            },
            indent=2
        )
    )

    raise SystemExit()

# --------------------------------------------------
# Load Repository
# --------------------------------------------------

repository = ClaimRepository()

repository_claims = (
    repository.load_claims()
)

print(
    f"\nLoaded "
    f"{len(repository_claims)} "
    f"claims from repository"
)

# --------------------------------------------------
# Match Claims
# --------------------------------------------------

matcher = ClaimMatcher()

for eob_claim in payload.get(
    "claims",
    []
):

    match_input = (
        EOBMatchMapper.to_match_input(
            eob_claim
        )
    )

    result = matcher.match(
        match_input,
        repository_claims
    )

    hitl_result = (
        HITLDecisionEngine
        .evaluate_match(
            result
        )
    )

    print("\n" + "=" * 100)

    print("\nMATCH INPUT")
    print(
        json.dumps(
            match_input,
            indent=2
        )
    )

    print("\nBEST MATCH")
    print(
        json.dumps(
            result["best_match"],
            indent=2
        )
    )

    print("\nTOP CANDIDATES")

    for candidate in result.get(
        "top_candidates",
        []
    ):
        print(
        candidate.get("claim_id")
        )

    print("\nHITL DECISION")
    print(
        json.dumps(
            hitl_result,
            indent=2
        )
    )

    final_result = {
        "claim_id": eob_claim.get(
            "claim_id"
        ),
        "document_confidence":
            payload.get(
                "document_confidence"
            ),
        "match_score":
            hitl_result.get(
                "match_score"
            ),
        "requires_human_review":
            hitl_result.get(
                "requires_human_review"
            ),
        "reasons":
            hitl_result.get(
                "reasons"
            ),
        "matched_claim":
            result.get(
                "best_match"
            )
    }

    print("\nFINAL RESULT")
    print(
        json.dumps(
            final_result,
            indent=2
        )
    )