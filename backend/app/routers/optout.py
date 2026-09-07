"""One-click opt-out generator endpoint."""

from fastapi import APIRouter

from app.models import OptOutRequest, OptOutResponse
from app.services.optout_service import build_opt_out_email

router = APIRouter()


@router.post(
    "/optout",
    response_model=OptOutResponse,
    summary="Generate a CCPA/GDPR opt-out email template",
    description=(
        "Takes a company name and the user's flagged concerns, and returns a "
        "pre-formulated legal opt-out email referencing CCPA/CPRA and GDPR rights. "
        "Purely templated — no LLM, no network."
    ),
)
def generate_opt_out(payload: OptOutRequest) -> OptOutResponse:
    result = build_opt_out_email(payload.company_name, payload.flagged_items)
    return OptOutResponse(**result)