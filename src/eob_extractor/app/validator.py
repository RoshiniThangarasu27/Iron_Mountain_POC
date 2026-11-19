class Validator:

    @staticmethod
    def validate_claim(claim):

        errors = []

        billed = claim.get("billed_amount")

        allowed = claim.get("allowed_amount")

        paid = claim.get("paid_amount")

        if billed is not None and allowed is not None and allowed > billed:
            errors.append("allowed > billed")

        if paid is not None and allowed is not None and paid > allowed:
            errors.append("paid > allowed")

        return errors
