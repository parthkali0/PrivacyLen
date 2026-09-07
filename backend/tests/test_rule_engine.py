"""Tests for the ultra-fast regex/rule engine and the /analyze endpoint.

These tests require no network or Ollama; they exercise the synchronous rule
engine directly plus the FastAPI endpoint in default (fast) mode.
"""

import time

from fastapi.testclient import TestClient

from app.main import app
from app.models import AnalysisCore
from app.services.rule_engine import analyze_fast

client = TestClient(app)

PRIVACY_TEXT = (
    "Welcome to Example Services. This Privacy Policy explains how we handle your data. "
    "We collect your precise GPS location, microphone audio, contacts address book, and "
    "browsing history. We also collect your IP address and device identifiers. "
    "We may sell your personal data to third-party data brokers and share it with "
    "marketing agencies for advertising. Any disputes shall be resolved by binding "
    "arbitration, and you agree to a class-action waiver. We may also use your content "
    "to train our AI models without prior notice."
)

NOISY_TEXT = (
    "This is a simple blog about coffee. The weather today is sunny and pleasant. "
    "We do not collect personal information or share anything with anyone."
)


def test_rule_engine_detects_all_categories() -> None:
    core = analyze_fast(PRIVACY_TEXT, source="https://example.com/privacy-policy")

    assert "GPS / precise location" in core.data_collected
    assert "Microphone / audio recordings" in core.data_collected
    assert "Contacts / address book" in core.data_collected
    assert "Browsing / search history" in core.data_collected
    assert any("IP address" in label for label in core.data_collected)

    assert "Selling personal data" in core.data_shared_or_sold
    assert any("data brokers" in label for label in core.data_shared_or_sold)

    assert "Mandatory binding arbitration" in core.rights_forfeited
    assert "Class-action waiver" in core.rights_forfeited
    assert any("train AI" in label for label in core.rights_forfeited)


def test_rule_engine_trust_score_and_severities() -> None:
    core = analyze_fast(PRIVACY_TEXT)
    assert 1 <= core.trust_score <= 10
    assert core.trust_score < 6

    severities = [flag.severity for flag in core.red_flags]
    assert severities == sorted(severities, key=lambda s: {"High": 0, "Medium": 1, "Low": 2}[s])
    assert any(flag.severity == "High" for flag in core.red_flags)
    assert core.platform_name == "This platform"


def test_rule_engine_lean_text_scores_high() -> None:
    core = analyze_fast(NOISY_TEXT)
    assert core.trust_score == 10
    assert core.data_collected == []
    assert core.red_flags == []


def test_rule_engine_is_validated_model() -> None:
    core = analyze_fast(PRIVACY_TEXT)
    AnalysisCore.model_validate(core.model_dump())
    assert core.model_dump()["trust_score"] >= 1


def test_rule_engine_never_crashes_on_empty_edges() -> None:
    for sample in ("", "   ", "no keywords at all here"):
        core = analyze_fast(sample if sample.strip() else sample)
        assert 1 <= core.trust_score <= 10
        assert core.summary


def test_analyze_endpoint_fast_and_valid() -> None:
    response = client.post("/api/v1/analyze", json={"text": PRIVACY_TEXT})
    assert response.status_code == 200
    body = response.json()
    assert body["model_used"] == "regex-rule-engine"
    assert isinstance(body["trust_score"], int)
    assert 1 <= body["trust_score"] <= 10
    assert body["platform_name"]
    assert body["summary"]
    assert isinstance(body["red_flags"], list)


def test_analyze_endpoint_under_50ms() -> None:
    start = time.perf_counter()
    response = client.post("/api/v1/analyze", json={"text": PRIVACY_TEXT * 50})
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert response.status_code == 200
    assert elapsed_ms < 50, f"analyze took {elapsed_ms:.1f}ms (expected < 50ms)"


def test_llm_mode_unavailable_returns_503_when_no_ollama(monkeypatch) -> None:
    from app.routers import analyze as analyze_module
    from app.services.ollama_service import LLMAvailabilityError

    monkeypatch.setattr(analyze_module.settings, "analysis_mode", "llm")

    async def fake_raise(*args, **kwargs):
        raise LLMAvailabilityError("simulated: no Ollama")

    monkeypatch.setattr(analyze_module, "analyze_privacy_policy", fake_raise)
    response = client.post("/api/v1/analyze", json={"text": PRIVACY_TEXT})
    assert response.status_code == 503
    assert "Ollama" in response.json()["detail"]


def test_red_flags_generated_for_all_categories() -> None:
    """Red flags are produced for data collected, data shared, AND rights forfeited."""
    core = analyze_fast(PRIVACY_TEXT)
    collected_flags = [f for f in core.red_flags if "location" in f.explanation.lower()
                       or "microphone" in f.explanation.lower()
                       or "contacts" in f.explanation.lower()
                       or "browsing" in f.explanation.lower()
                       or "device" in f.explanation.lower()]
    shared_flags = [f for f in core.red_flags if "sold" in f.explanation.lower()
                    or "brokers" in f.explanation.lower()]
    rights_flags = [f for f in core.red_flags if "arbitration" in f.explanation.lower()
                    or "class-action" in f.explanation.lower()
                    or "AI models" in f.explanation]
    assert len(collected_flags) >= 3, "Expected red flags for data collection categories"
    assert len(shared_flags) >= 1, "Expected red flags for data sharing categories"
    assert len(rights_flags) >= 2, "Expected red flags for rights forfeiture categories"


def test_trust_score_penalized_by_all_categories() -> None:
    """Each flagged category reduces the trust score, not just rights."""
    clean = analyze_fast("No data collected here at all.")
    partial = analyze_fast("We collect your precise GPS location.")
    full = analyze_fast(PRIVACY_TEXT)
    assert clean.trust_score == 10
    assert partial.trust_score < clean.trust_score
    assert full.trust_score <= partial.trust_score


def test_response_payload_matches_analyze_response_contract() -> None:
    """The full /analyze response includes all required AnalyzeResponse fields."""
    response = client.post("/api/v1/analyze", json={"text": PRIVACY_TEXT})
    body = response.json()
    required_fields = {
        "trust_score", "platform_name", "summary",
        "data_collected", "data_shared_or_sold", "rights_forfeited",
        "red_flags", "analyzed_at", "source", "model_used",
    }
    assert required_fields.issubset(body.keys())
    for flag in body["red_flags"]:
        assert set(flag.keys()) == {"clause", "severity", "explanation"}
        assert flag["severity"] in ("High", "Medium", "Low")