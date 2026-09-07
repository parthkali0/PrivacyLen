"""Tests for v2 endpoints: opt-out generator and policy tracker / diff engine.

All endpoints run locally with zero network; the SQLite store is pointed at a
unique temp file per run.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import policy_store

# Point the store at an isolated temp DB before any request.
import tempfile
from pathlib import Path

policy_store.DB_PATH = Path(tempfile.gettempdir()) / f"pl_test_v2_{id(object())}.db"
policy_store.init_db()

client = TestClient(app)


def test_optout_returns_template() -> None:
    response = client.post(
        "/api/v1/optout",
        json={"company_name": "CorpX", "flagged_items": ["Location Selling", "AI Training"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert "CorpX" in body["subject"]
    assert "CCPA" in body["body"]
    assert "GDPR" in body["body"]
    assert "- Location Selling" in body["body"]
    assert len(body["references"]) >= 3


def test_optout_with_no_items() -> None:
    response = client.post("/api/v1/optout", json={"company_name": "CorpX", "flagged_items": []})
    assert response.status_code == 200
    assert "concerned about practices related to the sale" in response.json()["body"]


def test_optout_rejects_blank_company() -> None:
    response = client.post("/api/v1/optout", json={"company_name": "  ", "flagged_items": []})
    assert response.status_code == 422


def test_track_policy_and_list() -> None:
    response = client.post(
        "/api/v1/policies",
        json={"url": "https://acme.example/privacy", "text": "We collect your data. This is version one."},
    )
    assert response.status_code == 201
    record = response.json()
    assert record["url"] == "https://acme.example/privacy"
    assert record["text_hash"]
    assert record["char_count"] > 0
    assert record["text_preview"]

    listed = client.get("/api/v1/policies").json()
    assert any(item["id"] == record["id"] for item in listed)
    assert all("text_hash" in item for item in listed)


def test_diff_inline_texts() -> None:
    response = client.post(
        "/api/v1/diff",
        json={"base_text": "One. Two. Three.", "new_text": "One. Three. Four."},
    )
    assert response.status_code == 200
    diff = response.json()
    assert diff["added_clauses"] == ["Four."]
    assert diff["removed_clauses"] == ["Two."]
    assert diff["unchanged_clause_count"] == 2
    assert 0 < diff["change_percent"] <= 100


def test_diff_by_url_uses_latest_saved() -> None:
    url = "https://diff.example/terms"
    client.post("/api/v1/policies", json={"url": url, "text": "Clause A. Clause B."})
    response = client.post(
        "/api/v1/diff",
        json={"url": url, "new_text": "Clause A. Clause NEW."},
    )
    assert response.status_code == 200
    diff = response.json()
    assert diff["base_identifier"] == url
    assert "NEW" in diff["added_clauses"][0]


def test_diff_by_saved_id() -> None:
    record = client.post("/api/v1/policies", json={"text": "Alpha. Beta."}).json()
    response = client.post(
        "/api/v1/diff",
        json={"base_id": record["id"], "new_text": "Alpha. Beta. Gamma."},
    )
    assert response.status_code == 200
    assert response.json()["added_clauses"] == ["Gamma."]


def test_diff_missing_base_returns_404() -> None:
    response = client.post(
        "/api/v1/diff",
        json={"base_id": 999999, "new_text": "Anything at all."},
    )
    assert response.status_code == 404


def test_diff_no_base_source_returns_422() -> None:
    response = client.post("/api/v1/diff", json={"new_text": "Only new text."})
    assert response.status_code == 422


def test_diff_identical_texts() -> None:
    response = client.post(
        "/api/v1/diff",
        json={"base_text": "Same. Same.", "new_text": "Same. Same."},
    )
    assert response.status_code == 200
    diff = response.json()
    assert diff["added_clauses"] == []
    assert diff["removed_clauses"] == []
    assert diff["change_percent"] == 0.0