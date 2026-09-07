"""Pydantic models enforcing the strict contract between the LLM and the API."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Severity(str, Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class RedFlag(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clause: str = Field(description="Short quote or paraphrase of the concerning clause.")
    severity: Severity = Field(description="Curated risk severity: High, Medium or Low.")
    explanation: str = Field(description="Plain-English explanation of why this is a concern.")


class AnalysisCore(BaseModel):
    """The exact JSON contract the LLM must return (strict, no extra keys)."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    trust_score: int = Field(ge=1, le=10, description="Risk score, 1 (egregious) to 10 (excellent).")
    platform_name: str = Field(min_length=1, description="Company/platform the policy belongs to.")
    summary: str = Field(min_length=1, description="Two-sentence plain-English executive summary.")
    data_collected: list[str] = Field(default_factory=list)
    data_shared_or_sold: list[str] = Field(default_factory=list)
    rights_forfeited: list[str] = Field(default_factory=list)
    red_flags: list[RedFlag] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    """Incoming request from the dashboard or browser extension."""

    text: Optional[str] = Field(default=None, max_length=500_000)
    url: Optional[str] = Field(default=None, max_length=2048)

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and not value.strip():
            raise ValueError("text must not be blank")
        return value

    @field_validator("url")
    @classmethod
    def url_must_be_http(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and not value.startswith(("http://", "https://")):
            raise ValueError("url must start with http:// or https://")
        return value


class AnalyzeResponse(BaseModel):
    """Full response returned to clients (validated core + analysis metadata)."""

    trust_score: int = Field(ge=1, le=10)
    platform_name: str
    summary: str
    data_collected: list[str]
    data_shared_or_sold: list[str]
    rights_forfeited: list[str]
    red_flags: list[RedFlag]
    analyzed_at: str = Field(description="UTC ISO-8601 timestamp of the analysis.")
    source: Optional[str] = Field(default=None, description="URL analyzed, if any.")
    model_used: str = Field(description="Ollama model that produced the analysis.")


# --------------------------------------------------------------------------- #
# v2 models: opt-out generator, policy tracker and diff engine.
# --------------------------------------------------------------------------- #


class OptOutRequest(BaseModel):
    """Request to generate a legal opt-out email template."""

    company_name: str = Field(min_length=1, max_length=200, description="Company/platform to address the email to.")
    flagged_items: list[str] = Field(default_factory=list, max_length=50, description="Concerns to cite in the email.")

    @field_validator("company_name")
    @classmethod
    def company_name_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("company_name must not be blank")
        return value.strip()


class OptOutResponse(BaseModel):
    """A ready-to-send opt-out email referencing CCPA/GDPR rights."""

    subject: str = Field(description="Email subject line.")
    body: str = Field(description="Plain-text email body with placeholders for the user's identity.")
    references: list[str] = Field(default_factory=list, description="Legal statutes cited.")


class TrackPolicyRequest(BaseModel):
    """Request to save a policy URL + text into the local policy store."""

    url: Optional[str] = Field(default=None, max_length=2048)
    text: str = Field(min_length=1, max_length=200_000)

    @field_validator("url")
    @classmethod
    def url_must_be_http(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and not value.startswith(("http://", "https://")):
            raise ValueError("url must start with http:// or https://")
        return value


class PolicyRecord(BaseModel):
    """Saved policy entry returned by the tracker."""

    id: int
    url: Optional[str] = None
    text_hash: str = Field(description="SHA-256 of the normalized text.")
    text_preview: str = Field(description="First ~160 characters of the policy.")
    char_count: int
    saved_at: str = Field(description="UTC ISO-8601 timestamp.")


class DiffRequest(BaseModel):
    """Compare two versions of an agreement.

    Provide ``new_text`` plus exactly one base source: inline ``base_text``,
    a previously saved ``base_id``, or the latest saved version for ``url``.
    """

    base_text: Optional[str] = Field(default=None, max_length=2_000_000)
    base_id: Optional[int] = Field(default=None)
    url: Optional[str] = Field(default=None, max_length=2048)
    new_text: str = Field(min_length=1, max_length=2_000_000)

    @field_validator("url")
    @classmethod
    def url_must_be_http(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and not value.startswith(("http://", "https://")):
            raise ValueError("url must start with http:// or https://")
        return value


class DiffResult(BaseModel):
    """Added/removed clauses between two agreement versions."""

    base_identifier: str = Field(description="How the base version was resolved (url, id, or inline).")
    base_text_hash: str
    new_text_hash: str
    added_clauses: list[str] = Field(default_factory=list)
    removed_clauses: list[str] = Field(default_factory=list)
    unchanged_clause_count: int = 0
    change_percent: float = Field(ge=0, le=100, description="Share of clauses that differ.")