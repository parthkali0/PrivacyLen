"""Safe HTML text extraction from a given URL."""

from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from requests.exceptions import RequestException

from app.config import get_settings

BLOCKED_TAGS = ("script", "style", "noscript", "svg", "canvas", "iframe", "nav", "footer", "form")


class ScrapeError(Exception):
    """Raised when a URL cannot be fetched or parsed safely."""


def _is_http_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def scrape_text(url: str) -> str:
    """Fetch ``url`` and return its cleaned main text content."""
    settings = get_settings()

    if not _is_http_url(url):
        raise ScrapeError(f"Unsupported or invalid URL: {url!r}")

    headers = {"User-Agent": settings.scrape_user_agent}
    try:
        response = requests.get(url, headers=headers, timeout=settings.scrape_timeout_seconds)
        response.raise_for_status()
    except RequestException as exc:
        raise ScrapeError(f"Failed to fetch {url}: {exc}") from exc

    soup = BeautifulSoup(response.text, "html.parser")

    for tag in soup(BLOCKED_TAGS):
        tag.decompose()

    body = soup.find("body") or soup
    lines = [line.strip() for line in body.get_text(separator="\n", strip=True).splitlines() if line.strip()]
    normalized = "\n".join(lines)
    return normalized[: settings.scrape_max_chars]