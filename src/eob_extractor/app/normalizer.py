NORMALIZATION_MAP = {
    "member responsibility": "patient_responsibility",
    "insured liability": "patient_responsibility",
    "patient responsibility": "patient_responsibility",
}


class Normalizer:

    def normalize(self, payload):

        # If payload is already a dict, keep it as a dict
        if isinstance(payload, dict):
            return payload

        # If payload is a JSON string, convert to dict
        if isinstance(payload, str):

            import json

            try:
                payload = json.loads(payload)
            except Exception:
                return payload

        return payload