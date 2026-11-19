from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError

from app.models.document import DocType


@dataclass(frozen=True)
class DocTypeRule:
    label: str
    extensions: frozenset[str]
    accepted_client_mime: frozenset[str] | None


TEXT_CLIENT_MIME = frozenset(
    {
        "text/plain",
        "application/edi-x12",
        "application/edi",
        "application/x12",
        "application/octet-stream",
        "",
    }
)
IMAGE_CLIENT_MIME = frozenset(
    {"image/png", "image/jpeg", "image/jpg", "image/pjpeg", "image/webp", "application/octet-stream", ""}
)

RULES: dict[DocType, DocTypeRule] = {
    DocType.EDI_837: DocTypeRule(
        label="837 EDI",
        extensions=frozenset({".txt", ".edi", ".x12", ".dat"}),
        accepted_client_mime=TEXT_CLIENT_MIME,
    ),
    DocType.EOB_835: DocTypeRule(
        label="EOB / 835",
        extensions=frozenset({".png", ".jpg", ".jpeg", ".webp"}),
        accepted_client_mime=IMAGE_CLIENT_MIME,
    ),
}

PIL_FORMAT_TO_MIME = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}


class ValidationError(Exception):
    pass


def validate_request_metadata(doc_type: DocType, filename: str | None, client_mime: str | None) -> None:
    rule = RULES[doc_type]
    if not filename:
        raise ValidationError("Missing filename")
    ext = Path(filename).suffix.lower()
    if ext not in rule.extensions:
        allowed = ", ".join(sorted(rule.extensions))
        raise ValidationError(f"Extension '{ext or '(none)'}' is not allowed for {rule.label}. Allowed: {allowed}")
    mime = (client_mime or "").split(";")[0].strip().lower()
    if rule.accepted_client_mime is not None and mime not in rule.accepted_client_mime:
        raise ValidationError(f"Content-Type '{mime}' is not allowed for {rule.label}")


def sniff_text(path: Path, sample_size: int = 64 * 1024) -> str:
    with open(path, "rb") as fh:
        sample = fh.read(sample_size)
    if b"\x00" in sample:
        raise ValidationError("File appears to be binary, expected plain-text X12/EDI content")
    control = sum(1 for b in sample if b < 32 and b not in (9, 10, 13) and b not in (28, 29, 30, 31))
    if sample and control / len(sample) > 0.05:
        raise ValidationError("File contains too many control characters to be plain text")
    return "text/plain"


def inspect_image(path: Path) -> tuple[str, dict[str, Any]]:
    try:
        with Image.open(path) as img:
            fmt = (img.format or "").upper()
            width, height = img.size
            mode = img.mode
            img.verify()
    except UnidentifiedImageError as exc:
        raise ValidationError("File is not a recognizable image (expected PNG, JPEG or WEBP)") from exc
    except Image.DecompressionBombError as exc:
        raise ValidationError("Image dimensions are too large to process safely") from exc
    except (OSError, SyntaxError, ValueError) as exc:
        raise ValidationError("Image file is corrupt or truncated") from exc

    mime = PIL_FORMAT_TO_MIME.get(fmt)
    if not mime:
        raise ValidationError(f"Image format '{fmt or 'unknown'}' is not allowed. Allowed: PNG, JPEG, WEBP")
    return mime, {"format": fmt, "width": width, "height": height, "mode": mode}
