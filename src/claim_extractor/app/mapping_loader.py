import json


def load_mapping():

    with open(
        "src/claim_extractor/app/config/default_837_mapping.json",
        "r"
    ) as file:

        return json.load(file)