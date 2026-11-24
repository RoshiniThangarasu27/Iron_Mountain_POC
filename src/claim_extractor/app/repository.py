import json
from pathlib import Path


class ClaimRepository:

    def load_claims(self):

        claims = []

        repo_path = Path(
            "src/claim_extractor/app/repository/claims"
        )

        for file in repo_path.glob("*.json"):
            with open(file, "r") as f:
                claims.append(json.load(f))

        return claims