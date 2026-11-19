import os
from enum import Enum


class FolderType(str, Enum):
    CLAIM_837 = "837"


def get_upload_folder(folder_type):

    folder = os.path.join(
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
        "app",
        "repository",
        "claims"
    )

    os.makedirs(
        folder,
        exist_ok=True
    )

    return folder