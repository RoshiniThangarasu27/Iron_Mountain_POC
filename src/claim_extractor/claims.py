import os

from fastapi import APIRouter
from fastapi import UploadFile
from fastapi import File

from src.claim_extractor.app.storage import (
    get_upload_folder,
    FolderType
)

from src.claim_extractor.app.edi_parser import (
    parse_837
)

from src.claim_extractor.app.claim_service import (
    ClaimService
)

router = APIRouter(
    prefix="/claims/837",
    tags=["Claims"]
)


@router.post("/upload")
async def upload_claim(
        file: UploadFile = File(...)
):


    contents = await file.read()
    print("test")
    upload_folder = get_upload_folder(
        FolderType.CLAIM_837
    )

    file_path = os.path.join(
        upload_folder,
        file.filename # type: ignore
    ) # type: ignore

    with open(
        file_path,
        "wb"
    ) as f:

        f.write(contents)

    edi_text = contents.decode(
        "utf-8"
    )

    claim = parse_837(
        edi_text
    )

    ClaimService.save_claim(
        claim,
        file.filename,
        edi_text
    )

    return {
        "message":
        "837 uploaded successfully",
        "claim":
        claim
    }

@router.get("")
def get_claims():

    return (
        ClaimService
        .get_all_claims()
    )