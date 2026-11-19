from typing import Any

from claim_extractor.app.mapping_loader import (
    load_mapping
)


def parse_837(edi_text):

    mapping = load_mapping()

    claim: dict[str, Any] = {
        "service_lines": []
    }

    segments = edi_text.split("~")

    current_service_line = None

    for segment in segments:

        segment = segment.strip()

        if not segment:
            continue

        fields = segment.split("*")

        segment_name = fields[0]

        # ------------------------
        # Claim Header Extraction
        # ------------------------

        for field_name, config in mapping.items():

            if config["segment"] != segment_name:
                continue

            qualifier = config.get(
                "qualifier"
            )

            if qualifier:

                if len(fields) < 2:
                    continue

                if fields[1] != qualifier:
                    continue

            position = config["element"]

            if len(fields) <= position:
                continue

            value = fields[position]

            if "remove_prefix" in config:

                value = value.replace(
                    config["remove_prefix"],
                    ""
                )

            # Service line fields handled separately
            if field_name in [
                "procedure_code",
                "line_charge_amount",
                "units"
            ]:
                continue

            claim[field_name] = value

        # ------------------------
        # Service Line Extraction
        # ------------------------

        if segment_name == "SV1":

            service_line = {}

            # Procedure Code

            if len(fields) > 1:

                service_line[
                    "procedure_code"
                ] = (
                    fields[1]
                    .replace("HC:", "")
                )

            # Charge Amount

            if len(fields) > 2:

                service_line[
                    "line_charge_amount"
                ] = fields[2]

            # Units

            if len(fields) > 4:

                service_line[
                    "units"
                ] = fields[4]

            claim[
                "service_lines"
            ].append(
                service_line
            )

    # Build patient name

    claim["patient_name"] = (
        f"{claim.get('patient_first_name','')} "
        f"{claim.get('patient_last_name','')}"
    ).strip()

    return claim