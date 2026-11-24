from app.validator import Validator


def test_paid_not_greater_than_allowed():

    claim = {"billed_amount": 100, "allowed_amount": 80, "paid_amount": 70}

    errors = Validator.validate_claim(claim)

    assert len(errors) == 0


def test_paid_greater_than_allowed():

    claim = {"billed_amount": 100, "allowed_amount": 50, "paid_amount": 60}

    errors = Validator.validate_claim(claim)

    assert len(errors) == 1
