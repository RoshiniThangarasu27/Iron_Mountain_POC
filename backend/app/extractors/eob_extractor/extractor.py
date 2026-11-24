import base64
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import openai
from openai import AzureOpenAI

from app.core.config import settings
from app.extractors.errors import ExtractionConfigError, ExtractionError

PROMPT_PATH = Path(__file__).with_name("extraction_prompt.txt")
USER_INSTRUCTION = "Extract the EOB into structured JSON."

TRANSIENT_ERRORS: tuple[type[Exception], ...] = (
    openai.APIConnectionError,
    openai.APITimeoutError,
    openai.RateLimitError,
    openai.InternalServerError,
)


@lru_cache
def load_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


def get_client() -> AzureOpenAI:
    if not settings.azure_openai_configured:
        raise ExtractionConfigError(
            "Azure OpenAI is not configured: set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY and AZURE_OPENAI_DEPLOYMENT"
        )
    return AzureOpenAI(
        azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
        api_key=settings.AZURE_OPENAI_KEY,
        api_version=settings.AZURE_OPENAI_API_VERSION,
        timeout=settings.AZURE_OPENAI_TIMEOUT_SECONDS,
        max_retries=0,
    )


def strip_code_fences(content: str) -> str:
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else ""
    if content.endswith("```"):
        content = content[:-3]
    return content.strip()


def normalize(payload: Any) -> dict[str, Any]:
    if isinstance(payload, str):
        payload = json.loads(payload)
    if not isinstance(payload, dict):
        raise ExtractionError("Model response is not a JSON object")
    return payload


def validate_claim(claim: dict[str, Any]) -> list[str]:
    errors = []
    billed = claim.get("billed_amount")
    allowed = claim.get("allowed_amount")
    paid = claim.get("paid_amount")
    try:
        if billed is not None and allowed is not None and float(allowed) > float(billed):
            errors.append("allowed > billed")
        if paid is not None and allowed is not None and float(paid) > float(allowed):
            errors.append("paid > allowed")
    except (TypeError, ValueError):
        errors.append("non-numeric amount")
    return errors


def review_decision(payload: dict[str, Any]) -> dict[str, Any]:
    confidence = payload.get("document_confidence")
    try:
        confidence_value = float(confidence) if confidence is not None else 0.0
    except (TypeError, ValueError):
        confidence_value = 0.0

    if payload.get("requires_human_review", False):
        return {"required": True, "reason": "LLM requested review"}
    if confidence_value < settings.EOB_REVIEW_CONFIDENCE_THRESHOLD:
        return {"required": True, "reason": f"Low document confidence ({confidence_value})"}
    return {"required": False, "reason": None}


def call_model(image: bytes, mime_type: str) -> str:
    client = get_client()
    image_base64 = base64.b64encode(image).decode("ascii")
    response = client.chat.completions.create(
        model=settings.AZURE_OPENAI_DEPLOYMENT,
        messages=[
            {"role": "system", "content": load_prompt()},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": USER_INSTRUCTION},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_base64}"}},
                ],
            },
        ],
        temperature=0,
    )
    content = response.choices[0].message.content if response.choices else None
    if not content:
        raise ExtractionError("Model returned empty content")
    return content


def extract_eob(image: bytes, mime_type: str) -> dict[str, Any]:
    content = call_model(image, mime_type)
    try:
        payload = normalize(strip_code_fences(content))
    except json.JSONDecodeError as exc:
        raise ExtractionError(f"Model did not return valid JSON: {exc.msg}") from exc

    claims = payload.get("claims") or []
    validation = {
        str(claim.get("claim_id") or index): issues
        for index, claim in enumerate(claims)
        if isinstance(claim, dict) and (issues := validate_claim(claim))
    }
    return {
        "payload": payload,
        "review": review_decision(payload),
        "validation_errors": validation,
        "model": settings.AZURE_OPENAI_DEPLOYMENT,
    }
