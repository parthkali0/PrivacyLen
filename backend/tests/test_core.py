"""Unit tests for Privacy Lens core logic.

Requires no running services: these tests exercise JSON extraction, URL
validation and the strict Pydantic contract in isolation.
"""

import pytest
from pydantic import ValidationError

from app.models import AnalysisCore, Severity
from app.services.ollama_service import _extract_json
from app.services.scraper import _is_http_url


def test_extract_json_plain() -> None:
    raw = '{"trust_score": 4, "platform_name": "X Corp"}'
    assert _extract_json(raw)["trust_score"] == 4


def test_extract_json_with_code_fence() -> None:
    raw = '```json\n{"trust_score": 7}\n```'
    assert _extract_json(raw)["trust_score"] == 7


def test_extract_json_ignores_surrounding_text() -> None:
    raw = 'Here is your analysis:\n{"trust_score": 2}\nHope that helps!'
    assert _extract_json(raw)["trust_score"] == 2


def test_extract_json_missing_object() -> None:
    with pytest.raises(ValueError):
        _extract_json("no json object here")


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://example.com/privacy", True),
        ("http://example.com", True),
        ("ftp://example.com/policy", False),
        ("javascript:alert(1)", False),
        ("not a url", False),
    ],
)
def test_is_http_url(url: str, expected: bool) -> None:
    assert _is_http_url(url) is expected


VALID_CORE = {
    "trust_score": 6,
    "platform_name": "Example Corp",
    "summary": "The policy collects basic account data. Watch out for third-party sharing.",
    "data_collected": ["Email", "IP address"],
    "data_shared_or_sold": ["Advertising identifiers"],
    "rights_forfeited": ["Class-action waiver"],
    "red_flags": [
        {"clause": "Arbitration clause", "severity": "Medium", "explanation": "You give up the right to sue."}
    ],
}


def test_analysis_core_validates() -> None:
    core = AnalysisCore.model_validate(VALID_CORE)
    assert core.trust_score == 6
    assert core.red_flags[0].severity == Severity.MEDIUM
    assert core.data_collected == ["Email", "IP address"]


def test_analysis_core_rejects_unknown_keys() -> None:
    payload = {**VALID_CORE, "bogus_key": "nope"}
    with pytest.raises(ValidationError):
        AnalysisCore.model_validate(payload)


def test_analysis_core_rejects_out_of_range_score() -> None:
    payload = {**VALID_CORE, "trust_score": 42}
    with pytest.raises(ValidationError):
        AnalysisCore.model_validate(payload)


def test_analysis_core_rejects_bad_severity() -> None:
    payload = {
        **VALID_CORE,
        "red_flags": [{"clause": "x", "severity": "Catastrophic", "explanation": "bogus"}],
    }
    with pytest.raises(ValidationError):
        AnalysisCore.model_validate(payload)