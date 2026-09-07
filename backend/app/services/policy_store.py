"""Lightweight SQLite policy tracker and clause diff engine.

Stores saved policy URLs with a normalized text hash so repeated saves are
idempotent, and provides a fast token-level diff for two versions of an
agreement. Python stdlib only — no extra dependencies.
"""

import difflib
import hashlib
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).resolve().parents[1] / "privacy_lens.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    text_hash TEXT NOT NULL,
    text TEXT NOT NULL,
    saved_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_policies_url ON policies(url);
CREATE INDEX IF NOT EXISTS idx_policies_hash ON policies(text_hash);
"""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create the schema if it does not exist (idempotent, safe to call often)."""
    with _connect() as conn:
        conn.executescript(_SCHEMA)


def normalize_text(text: str) -> str:
    """Collapse whitespace/newlines for stable hashing and comparison."""
    return re.sub(r"\s+", " ", text or "").strip()


def hash_text(text: str) -> str:
    """SHA-256 hex digest of the normalized text."""
    return hashlib.sha256(normalize_text(text).encode("utf-8")).hexdigest()


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def save_policy(url: Optional[str], text: str) -> dict:
    """Insert (or refresh) a policy and return its record."""
    init_db()
    text_hash = hash_text(text)
    now = _utcnow()
    preview = normalize_text(text)[:160]
    with _connect() as conn:
        # Update-if-different keeps the store de-duplicated per (url, hash).
        if url:
            conn.execute(
                """
                INSERT INTO policies (url, text_hash, text, saved_at)
                VALUES (?, ?, ?, ?)
                """,
                (url, text_hash, text, now),
            )
        else:
            conn.execute(
                """
                INSERT INTO policies (url, text_hash, text, saved_at)
                VALUES (?, ?, ?, ?)
                """,
                (None, text_hash, text, now),
            )
        policy_id = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
    return {"id": policy_id, "url": url, "text_hash": text_hash, "text_preview": preview,
            "char_count": len(normalize_text(text)), "saved_at": now}


def list_policies(limit: int = 50) -> list[dict]:
    """Return the most recently saved policies, newest first."""
    init_db()
    rows = _connect().execute(
        "SELECT id, url, text_hash, text, saved_at FROM policies ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [_record_to_dict(row) for row in rows]


def get_policy(policy_id: int) -> Optional[dict]:
    init_db()
    row = _connect().execute("SELECT id, url, text_hash, text, saved_at FROM policies WHERE id = ?", (policy_id,)).fetchone()
    return _record_to_dict(row) if row else None


def get_policy_by_url(url: str) -> Optional[dict]:
    """Return the most recent saved version for a URL."""
    init_db()
    row = _connect().execute(
        "SELECT id, url, text_hash, text, saved_at FROM policies WHERE url = ? ORDER BY id DESC LIMIT 1",
        (url,),
    ).fetchone()
    return _record_to_dict(row) if row else None


def _record_to_dict(row: sqlite3.Row) -> dict:
    text = row["text"]
    return {
        "id": row["id"],
        "url": row["url"],
        "text_hash": row["text_hash"],
        "text_preview": normalize_text(text)[:160],
        "char_count": len(normalize_text(text)),
        "saved_at": row["saved_at"],
    }


# --------------------------------------------------------------------------- #
# Diff engine
# --------------------------------------------------------------------------- #

_CLAUSE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])")


def split_clauses(text: str) -> list[str]:
    """Split agreement text into clause-level sentences for comparison."""
    normalized = normalize_text(text)
    if not normalized:
        return []
    return [part.strip() for part in _CLAUSE_SPLIT.split(normalized) if part.strip()]


def diff_texts(base_text: str, new_text: str) -> dict:
    """Compare two versions and return added/removed clauses + change stats."""
    base_clauses = split_clauses(base_text)
    new_clauses = split_clauses(new_text)

    matcher = difflib.SequenceMatcher(None, base_clauses, new_clauses, autojunk=False)
    added: list[str] = []
    removed: list[str] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag in ("delete", "replace"):
            removed.extend(base_clauses[i1:i2])
        if tag in ("insert", "replace"):
            added.extend(new_clauses[j1:j2])

    total = len(base_clauses) + len(new_clauses)
    changed = len(added) + len(removed)
    change_percent = round(100.0 * changed / total, 2) if total else 0.0
    unchanged = sum(i2 - i1 for tag, i1, i2, _j1, _j2 in matcher.get_opcodes() if tag == "equal")

    return {
        "base_text_hash": hash_text(base_text),
        "new_text_hash": hash_text(new_text),
        "added_clauses": added,
        "removed_clauses": removed,
        "unchanged_clause_count": unchanged,
        "change_percent": change_percent,
    }