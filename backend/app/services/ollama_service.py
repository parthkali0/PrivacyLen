"""Ollama LLM orchestration with strict JSON contract enforcement."""

import json
import logging
import re
from typing import Optional

import httpx
from pydantic import ValidationError

from app.config import get_settings
from app.models import AnalysisCore

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are Privacy Lens, an expert legal-tech assistant that turns privacy policies, "
    "Terms of Service, and data contracts into plain English for the average user.\n\n"
    "Analyze the given text and return ONLY a single JSON object conforming exactly to this schema:\n"
    "\n{\n"
    '  "trust_score": <integer between 1 and 10>,\n'
    '  "platform_name": "<name of the company/platform, inferred if not explicit>",\n'
    '  "summary": "<exactly two plain-English sentences: first what the policy does, '
    'second what the user should watch out for>",\n'
    '  "data_collected": ["<short list of data types collected>"],\n'
    '  "data_shared_or_sold": ["<short list of data types shared with or sold to third parties>"],\n'
    '  "rights_forfeited": ["<legal rights the user gives up, e.g. arbitration, class-action waiver, '
    "unilateral changes>\"],\n"
    '  "red_flags": [\n'
    "    {\n"
    '      "clause": "<short quote or paraphrase of the concerning clause>",\n'
    '      "severity": "High",\n'
    '      "explanation": "<why this is risky, in plain English>"\n'
    "    }\n"
    "  ]\n"
    "}\n\n"
    "Rules:\n"
    '- "severity" must be exactly one of: "High", "Medium", "Low".\n'
    "- trust_score: 10 = excellent privacy practices, 1 = egregious.\n"
    "- Include red flags ranked from most to least important. If nothing is concerning, return an empty list.\n"
    "- Return valid JSON only. No markdown code fences, no commentary before or after the JSON object."
)


class LLMAvailabilityError(RuntimeError):
    """Raised when Ollama is unreachable or no configured model is installed."""


class LLMParseError(RuntimeError):
    """Raised when the model output cannot be parsed or validated against the schema."""


def _extract_json(raw: str) -> dict:
    """Extract the first JSON object from a model response."""
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end <= start:
        raise ValueError("No JSON object found in model output")

    return json.loads(text[start : end + 1])


def _build_user_prompt(text: str, source: Optional[str]) -> str:
    prefix = f"Source: {source}\n\n" if source else ""
    return (
        f"{prefix}Analyze the following privacy policy / terms text and answer with the required JSON:\n\n"
        f"{text[:120_000]}"
    )


async def _chat(client: httpx.AsyncClient, model: str, user_content: str) -> str:
    payload = {
        "model": model,
        "stream": False,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        "options": {"temperature": 0.2, "num_predict": 2048},
    }
    response = await client.post("/api/chat", json=payload)
    response.raise_for_status()
    return response.json().get("message", {}).get("content", "")


async def _first_available_model(
    client: httpx.AsyncClient, candidates: list[str]
) -> Optional[str]:
    """Pick the best available model: exact tag, then same family, then any installed model."""
    try:
        response = await client.get("/api/tags", timeout=5.0)
        response.raise_for_status()
    except (httpx.HTTPError, httpx.TransportError):
        return None

    installed = [item.get("name", "") for item in response.json().get("models", [])]
    if not installed:
        return None

    for candidate in candidates:
        if candidate in installed:
            return candidate
        family = candidate.split(":")[0]
        for name in installed:
            if name.split(":")[0] == family:
                logger.warning(
                    "Configured model %r not installed; using same-family model %r",
                    candidate,
                    name,
                )
                return name

    logger.warning(
        "None of the configured models %r is installed; falling back to %r",
        candidates,
        installed[0],
    )
    return installed[0]


async def analyze_privacy_policy(text: str, source: Optional[str] = None) -> tuple[AnalysisCore, str]:
    """Run the analysis against Ollama and return a validated :class:`AnalysisCore`.

    Returns ``(core, model_used)``. Raises :class:`LLMAvailabilityError` when the
    local Ollama instance is unreachable or no model is installed, and
    :class:`LLMParseError` when the model output does not match the schema.
    """
    settings = get_settings()
    user_content = _build_user_prompt(text, source)

    async with httpx.AsyncClient(
        base_url=settings.ollama_base_url,
        timeout=settings.ollama_timeout_seconds,
    ) as client:
        model = await _first_available_model(client, [settings.ollama_model, settings.ollama_fallback_model])

        if model is None:
            raise LLMAvailabilityError(
                f"Ollama is not reachable at {settings.ollama_base_url}, or Ollama has no "
                "models installed. Start Ollama and pull a model, e.g. `ollama pull llama3.1:8b`."
            )

        try:
            raw = await _chat(client, model, user_content)
        except (httpx.HTTPError, httpx.TransportError) as exc:
            raise LLMAvailabilityError(f"Chat request to Ollama model {model!r} failed: {exc}") from exc

        try:
            parsed = _extract_json(raw)
            return AnalysisCore.model_validate(parsed), model
        except (ValueError, ValidationError) as exc:
            raise LLMParseError(
                "The model response could not be validated against the required schema. "
                f"Raw preview: {raw[:200]!r}"
            ) from exc