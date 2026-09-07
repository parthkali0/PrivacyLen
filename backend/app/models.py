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