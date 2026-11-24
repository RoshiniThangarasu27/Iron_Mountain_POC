from rapidfuzz import fuzz


class ClaimScorer:

    @staticmethod
    def exact_match(eob_value, claim_value):

        if not eob_value or not claim_value:
            return 0

        return (
            1
            if str(eob_value).strip().lower()
            == str(claim_value).strip().lower()
            else 0
        )

    @staticmethod
    def fuzzy_match(eob_value, claim_value):

        if not eob_value or not claim_value:
            return 0

        return (
            fuzz.ratio(
                str(eob_value).lower(),
                str(claim_value).lower()
            )
            / 100
        )

    @staticmethod
    def date_match(eob_value, claim_value):

        if not eob_value or not claim_value:
            return 0

        return 1 if eob_value == claim_value else 0

    @staticmethod
    def amount_match(eob_amount, claim_amount):

        if eob_amount is None or claim_amount is None:
            return 0

        difference = abs(
            float(eob_amount)
            - float(claim_amount)
        )

        if difference == 0:
            return 1.0

        if difference <= 1:
            return 0.8

        if difference <= 5:
            return 0.5

        return 0