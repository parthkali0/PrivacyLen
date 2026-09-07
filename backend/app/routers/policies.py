"""Policy tracker and diff endpoints (lightweight SQLite store)."""

from fastapi import APIRouter, HTTPException

from app.models import DiffRequest, DiffResult, PolicyRecord, TrackPolicyRequest
from app.services import policy_store

router = APIRouter()
store = policy_store


@router.post(
    "/policies",
    response_model=PolicyRecord,
    status_code=201,
    summary="Save a policy URL + text into the local tracker",
)
def track_policy(payload: TrackPolicyRequest) -> PolicyRecord:
    record = store.save_policy(payload.url, payload.text)
    return PolicyRecord(**record)


@router.get(
    "/policies",
    response_model=list[PolicyRecord],
    summary="List recently saved policies",
)
def list_policies(limit: int = 50) -> list[PolicyRecord]:
    return [PolicyRecord(**record) for record in store.list_policies(limit=limit)]


@router.post(
    "/diff",
    response_model=DiffResult,
    summary="Compare two versions of an agreement",
    description=(
        "Compare ``new_text`` against a base version supplied inline (``base_text``), "
        "by saved policy id (``base_id``), or the latest saved version for a ``url``. "
        "Returns added/removed clause lists plus a change percentage."
    ),
)
def diff_policies(payload: DiffRequest) -> DiffResult:
    base_text = payload.base_text
    base_identifier = "inline text"

    if base_text is None:
        if payload.base_id is not None:
            record = store.get_policy(payload.base_id)
            if record is None:
                raise HTTPException(status_code=404, detail=f"No saved policy with id {payload.base_id}.")
            base_text = record and _full_text(payload.base_id)
            base_identifier = f"saved policy #{payload.base_id}"
        elif payload.url:
            record = store.get_policy_by_url(payload.url)
            if record is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No saved policy for {payload.url!r}. Save one via POST /api/v1/policies first.",
                )
            base_text = _full_text(record["id"])
            base_identifier = payload.url
        else:
            raise HTTPException(
                status_code=422,
                detail="Provide one of: base_text, base_id, or url.",
            )

    diff = store.diff_texts(base_text, payload.new_text)
    diff["base_identifier"] = base_identifier
    return DiffResult(**diff)


def _full_text(policy_id: int) -> str:
    """Directly read the raw text for a saved policy (bypasses the preview record)."""
    import sqlite3

    conn = sqlite3.connect(store.DB_PATH)
    try:
        row = conn.execute("SELECT text FROM policies WHERE id = ?", (policy_id,)).fetchone()
    finally:
        conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail=f"No saved policy with id {policy_id}.")
    return row[0]