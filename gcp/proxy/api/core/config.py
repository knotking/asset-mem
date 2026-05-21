import os
from dotenv import load_dotenv

from core.cors import parse_cors_origins

load_dotenv()


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


class Settings:
    TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET")
    FIREBASE_WEBHOOK_SECRET = os.environ.get("FIREBASE_WEBHOOK_SECRET")
    GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
    FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID")
    USER_UPLOAD_RESULT_SUBSCRIPTION = os.environ.get("USER_UPLOAD_RESULT_SUBSCRIPTION")
    # When true, skip Bearer verification and trust user_id/userId in JSON (local dev / pytest).
    DISABLE_FIREBASE_AUTH = _env_bool("DISABLE_FIREBASE_AUTH", default=False)
    # Mount user routes under /{FIREBASE_WEBHOOK_SECRET}/ as well as / (migration).
    ENABLE_LEGACY_SECRET_PREFIX = _env_bool("ENABLE_LEGACY_SECRET_PREFIX", default=False)
    # Comma-separated browser origins; empty/unset → built-in allowlist (includes asset-mem.com).
    CORS_ALLOW_ORIGINS: list[str] = parse_cors_origins()
    # Per-UID rate limits (in-memory; see core/rate_limit.py).
    RATE_LIMIT_ENABLED = _env_bool("PROXY_RATE_LIMIT_ENABLED", default=True)
    RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("PROXY_RATE_LIMIT_WINDOW_SECONDS", "60"))
    RATE_LIMIT_AGENT_PER_WINDOW = int(os.environ.get("PROXY_RATE_LIMIT_AGENT_PER_WINDOW", "30"))
    RATE_LIMIT_CHECKPOINT_PER_WINDOW = int(
        os.environ.get("PROXY_RATE_LIMIT_CHECKPOINT_PER_WINDOW", "20")
    )
    RATE_LIMIT_DOCUMENTS_PER_WINDOW = int(
        os.environ.get("PROXY_RATE_LIMIT_DOCUMENTS_PER_WINDOW", "30")
    )
    RATE_LIMIT_QUOTA_PER_WINDOW = int(os.environ.get("PROXY_RATE_LIMIT_QUOTA_PER_WINDOW", "60"))
    # OpenTelemetry (optional; requires exporter packages on the image).
    OBSERVABILITY_ENABLE_TRACING = _env_bool("PROXY_OBSERVABILITY_TRACING", default=False)
    OBSERVABILITY_ENABLE_METRICS = _env_bool("PROXY_OBSERVABILITY_METRICS", default=False)

    def rate_limit_rule(self, bucket: str):
        from core.rate_limit import RateLimitRule

        limits = {
            "agent": self.RATE_LIMIT_AGENT_PER_WINDOW,
            "checkpoint": self.RATE_LIMIT_CHECKPOINT_PER_WINDOW,
            "documents": self.RATE_LIMIT_DOCUMENTS_PER_WINDOW,
            "quota": self.RATE_LIMIT_QUOTA_PER_WINDOW,
        }
        return RateLimitRule(
            max_requests=limits.get(bucket, 30),
            window_seconds=self.RATE_LIMIT_WINDOW_SECONDS,
        )


settings = Settings()

