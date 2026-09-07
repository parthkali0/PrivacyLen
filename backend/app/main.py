"""Privacy Lens FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import analyze, optout, policies

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "AI-powered privacy policy analyzer. Convert legalese, Terms of Service, and "
        "privacy contracts into plain English, a trust score, red flags, and recommendations. "
        "By default it uses an instant regex/rule engine (<50ms, no model needed); an "
        "optional local Ollama LLM can be enabled via ANALYSIS_MODE."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials="*" not in origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router, prefix=settings.api_prefix, tags=["analyze"])
app.include_router(optout.router, prefix=settings.api_prefix, tags=["optout"])
app.include_router(policies.router, prefix=settings.api_prefix, tags=["policies"])


@app.get("/health", tags=["meta"], summary="Health check")
async def health() -> dict:
    return {"status": "ok", "service": settings.app_name, "version": settings.app_version}


@app.get("/", include_in_schema=False)
async def root() -> dict:
    return {"service": settings.app_name, "docs": "/docs", "health": "/health"}