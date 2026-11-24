from datetime import datetime
from typing import Any

from src.claim_extractor.app.mapping_loader import (
    load_mapping
)


def format_edi_date(date_str: str) -> str:
    """
    Convert:
        20031014 -> 10/14/03
    """

    try:
        return datetime.strptime(
            date_str,
            "%Y%m%d"
        ).strftime("%m/%d/%y")

    except Exception:
        return date_str


def parse_837(edi_text: str) -> dict[str, Any]:

    mapping = load_mapping()

    claim: dict[str, Any] = {
        "service_lines": []
    }

    segments = edi_text.split("~")

    for segment in segments:

        segment = segment.strip()

        if not segment:
            continue

        fields = segment.split("*")

        segment_name = fields[0]

        # ------------------------
        # Header Extraction
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

            # Service line values handled separately
            if field_name in [
                "procedure_code",
                "line_charge_amount",
                "units"
            ]:
                continue

            # ------------------------
            # Service Date Handling
            # ------------------------

            if field_name == "date_of_service":

                # Original value
                claim["date_of_service"] = value

                # RD8 Date Range
                if "-" in value:

                    dos_from, dos_to = value.split(
                        "-",
                        1
                    )

                    claim[
                        "date_of_service_from"
                    ] = format_edi_date(
                        dos_from
                    )

                    claim[
                        "date_of_service_to"
                    ] = format_edi_date(
                        dos_to
                    )

                # D8 Single Date
                else:

                    formatted_date = (
                        format_edi_date(
                            value
                        )
                    )

                    claim[
                        "date_of_service_from"
                    ] = formatted_date

                    claim[
                        "date_of_service_to"
                    ] = formatted_date

            else:

                claim[field_name] = value

        # ------------------------
        # Service Line Extraction
        # ------------------------

        if segment_name == "SV1":

            service_line = {}

            # Procedure Code

            if len(fields) > 1:

                procedure_code = fields[1]

                if procedure_code.startswith(
                    "HC:"
                ):
                    procedure_code = (
                        procedure_code.replace(
                            "HC:",
                            ""
                        )
                    )

                service_line[
                    "procedure_code"
                ] = procedure_code

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
            ].append(service_line)

    # ------------------------
    # Patient Name
    # ------------------------

    first_name = claim.get(
        "patient_first_name",
        ""
    )

    last_name = claim.get(
        "patient_last_name",
        ""
    )

    claim["patient_name"] = (
        f"{first_name} {last_name}"
    ).strip()

    return claim