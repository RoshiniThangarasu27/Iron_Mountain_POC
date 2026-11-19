from app.normalizer import Normalizer


def test_normalization():

    data = {"field": "Member Responsibility"}

    result = Normalizer().normalize(data)

    assert result is not None
