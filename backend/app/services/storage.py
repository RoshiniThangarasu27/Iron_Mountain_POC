from __future__ import annotations

import hashlib
import logging
import os
import re
import unicodedata
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from app.core.config import settings

logger = logging.getLogger(__name__)

CHUNK_SIZE = 1024 * 1024
MAX_SAFE_NAME_LEN = 150
_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9._-]+")


class StorageError(Exception):
    pass


class FileTooLargeError(StorageError):
    pass


@dataclass
class StoredFile:
    stored_filename: str
    relative_path: str
    absolute_path: Path
    size_bytes: int
    sha256: str


def sanitize_filename(filename: str | None) -> str:
    name = (filename or "").replace("\\", "/").split("/")[-1]
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    name = _UNSAFE_CHARS.sub("_", name).strip("._-")
    if not name:
        return "file"
    if len(name) > MAX_SAFE_NAME_LEN:
        stem, dot, ext = name.rpartition(".")
        if dot and 0 < len(ext) <= 10:
            name = stem[: MAX_SAFE_NAME_LEN - len(ext) - 1] + "." + ext
        else:
            name = name[:MAX_SAFE_NAME_LEN]
    return name


def get_extension(filename: str | None) -> str:
    return Path(filename or "").suffix.lower()


def upload_root() -> Path:
    return Path(settings.UPLOAD_DIR).resolve()


def ensure_storage_dirs(doc_types: list[str]) -> None:
    root = upload_root()
    for doc_type in doc_types:
        (root / doc_type).mkdir(parents=True, exist_ok=True)


def resolve_storage_path(relative_path: str) -> Path:
    root = upload_root()
    candidate = (root / relative_path).resolve()
    if not candidate.is_relative_to(root):
        raise StorageError("Resolved storage path escapes the upload directory")
    return candidate


def save_stream(src: BinaryIO, doc_type: str, original_filename: str | None) -> StoredFile:
    root = upload_root()
    target_dir = (root / doc_type).resolve()
    if not target_dir.is_relative_to(root):
        raise StorageError("Invalid document type directory")
    target_dir.mkdir(parents=True, exist_ok=True)

    safe_name = sanitize_filename(original_filename)
    stored_filename = f"{uuid.uuid4().hex}_{safe_name}"
    final_path = target_dir / stored_filename
    tmp_path = target_dir / f".tmp_{uuid.uuid4().hex}"

    hasher = hashlib.sha256()
    size = 0
    limit = settings.max_upload_size_bytes
    try:
        with open(tmp_path, "wb") as out:
            while chunk := src.read(CHUNK_SIZE):
                size += len(chunk)
                if size > limit:
                    raise FileTooLargeError(
                        f"File exceeds the maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB} MB"
                    )
                hasher.update(chunk)
                out.write(chunk)
        if size == 0:
            raise StorageError("File is empty")
        os.replace(tmp_path, final_path)
    except BaseException:
        tmp_path.unlink(missing_ok=True)
        raise

    return StoredFile(
        stored_filename=stored_filename,
        relative_path=f"{doc_type}/{stored_filename}",
        absolute_path=final_path,
        size_bytes=size,
        sha256=hasher.hexdigest(),
    )


def delete_file(relative_path: str) -> bool:
    try:
        path = resolve_storage_path(relative_path)
        path.unlink(missing_ok=True)
        return True
    except (OSError, StorageError):
        logger.exception("Failed to delete stored file %s", relative_path)
        return False
