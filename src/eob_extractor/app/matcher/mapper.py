class EOBMatchMapper:

    @staticmethod
    def to_match_input(eob_claim: dict) -> dict:


        return {
            "patient_id": eob_claim.get("patient_id"),
            "claim_id": eob_claim.get("claim_id"),
            "patient_name":eob_claim.get("patient_name"),

            "date_of_service_from": eob_claim.get(
                "date_of_service_from"
            ),

            "date_of_service_to": eob_claim.get(
                "date_of_service_to"
            ),

            "service_code": eob_claim.get(
                "service_code"
            ),

            "billed_amount": eob_claim.get(
                "billed_amount"
            ),
            "provider_name" :eob_claim.get("provider_name")
        }