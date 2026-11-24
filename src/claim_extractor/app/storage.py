import os
from enum import Enum


class FolderType(str, Enum):
    CLAIM_837 = "837"


def get_upload_folder(folder_type):

    folder = os.path.join(
        "src",
        "claim_extractor",
        "app",
        "uploads",
        folder_type.value
    )

    os.makedirs(
        folder,
        exist_ok=True
    )

    return folder


def get_claim_repository():

    folder = os.path.join(
        "src",
        "claim_extractor",
        "app",
        "repository",
        "claims"
    )

    os.makedirs(
        folder,
        exist_ok=True
    )

    return folder