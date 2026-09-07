"""Analysis endpoint: accepts raw text or a URL, then runs the analysis engine.

The default path is the ultra-fast regex/rule engine (no LLM, no network),
which returns in well under 50 ms. Set ``ANALYSIS_MODE`` to ``hybrid`` to fall
back to the Ollama LLM when the rule engine finds no signals, or ``llm`` to
always use the (slow) local LLM.
"""

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.models import AnalyzeRequest, AnalyzeResponse
from app.services import scraper
from app.services.ollama_service import LLMAvailabilityError, LLMParseError, analyze_privacy_policy
from app.services.rule_engine import analyze_fast

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()


def _engine_name(mode: str, used_llm: bool) -> str:
    if mode == "llm" or used_llm:
        return "ollama-llm"
    return "regex-rule-engine"


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    summary="Analyze a privacy policy / Terms of Service",
    description=(
        "Convert a privacy policy into a structured TL;DR with a trust score, "
        "red flags, and recommendations. Pass either ``text`` or ``url``. "
        "Uses a fast regex engine by default; the Ollama LLM is optional."
    ),
)
async def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    text = payload.text
    source = payload.url

    if source:
        try:
            text = await asyncio.to_thread(scraper.scrape_text, source)
        except scraper.ScrapeError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not text or not text.strip():
        raise HTTPException(
            status_code=422,
            detail="Provide either non-empty 'text' or a valid 'url'.",
        )

    mode = settings.analysis_mode.lower()
    used_llm = False

    try:
        # Fast path: synchronous regex engine in a worker thread (instant).
        core = await asyncio.to_thread(analyze_fast, text, source)

        # In hybrid mode, escalate to the LLM only if the rule engine is empty.
        if (mode == "hybrid") and not (core.data_collected or core.data_shared_or_sold
                                      or core.rights_forfeited or core.red_flags):
            logger.info("hybrid mode: rule engine found no signals, escalating to LLM")
            core, _model = await analyze_privacy_policy(text, source=source)
            used_llm = True

        # In forced LLM mode, always run the model.
        if mode == "llm":
            core, _model = await analyze_privacy_policy(text, source=source)
            used_llm = True

    except LLMAvailabilityError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except LLMParseError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return AnalyzeResponse(
        trust_score=core.trust_score,
        platform_name=core.platform_name,
        summary=core.summary,
        data_collected=core.data_collected,
        data_shared_or_sold=core.data_shared_or_sold,
        rights_forfeited=core.rights_forfeited,
        red_flags=core.red_flags,
        analyzed_at=datetime.now(timezone.utc).isoformat(),
        source=source,
        model_used=_engine_name(mode, used_llm),
    )