import json
import os

from app.utils.storage import (
    get_claim_repository
)


class ClaimService:

    @staticmethod
    def save_claim(
        claim,
        file_name,
        raw_edi
    ):

        repository = (
            get_claim_repository()
        )

        claim["source_file"] = (
            file_name
        )

        claim["raw_edi"] = raw_edi

        claim_id = claim.get(
            "claim_id",
            "UNKNOWN"
        )

        output_file = os.path.join(
            repository,
            f"{claim_id}.json"
        )

        with open(
            output_file,
            "w"
        ) as f:

            json.dump(
                claim,
                f,
                indent=4
            )

        return claim

    @staticmethod
    def get_all_claims():

        repository = (
            get_claim_repository()
        )

        claims = []

        for file in os.listdir(
            repository
        ):

            if file.endswith(
                ".json"
            ):

                path = os.path.join(
                    repository,
                    file
                )

                with open(path) as f:

                    claims.append(
                        json.load(f)
                    )

        return claims