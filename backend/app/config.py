"""Application configuration loaded from environment variables / .env file."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Privacy Lens"
    app_version: str = "2.0.0"
    api_prefix: str = "/api/v1"

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    ollama_fallback_model: str = "qwen2.5:7b"
    ollama_timeout_seconds: float = 120.0

    # "fast"  = instant regex engine only (default, no Ollama required)
    # "hybrid"= use the regex engine, fall back to the LLM if patterns find nothing
    # "llm"   = always use the (slow) Ollama LLM path
    analysis_mode: str = "fast"

    cors_origins: str = "*"

    database_url: str = "postgresql+psycopg://privacy:privacy@localhost:5432/privacy_lens"

    scrape_user_agent: str = (
        "Mozilla/5.0 (compatible; PrivacyLens/1.0; +https://github.com/privacy-lens/privacy-lens)"
    )
    scrape_max_chars: int = 200_000
    scrape_timeout_seconds: int = 10

    @property
    def cors_origin_list(self) -> list[str]:
        """Return the parsed CORS origin allow-list.

        A single ``*`` is kept as wildcard so local development and the
        browser extension work without extra configuration.
        """
        raw = self.cors_origins.strip()
        if raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()