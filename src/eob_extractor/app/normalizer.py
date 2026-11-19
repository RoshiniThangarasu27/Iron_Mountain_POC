NORMALIZATION_MAP = {
    "member responsibility": "patient_responsibility",
    "insured liability": "patient_responsibility",
    "patient responsibility": "patient_responsibility",
}


class Normalizer:

    def normalize(self, payload):

        text = str(payload).lower()

        for old, new in NORMALIZATION_MAP.items():
            text = text.replace(old, new)

        return payload
