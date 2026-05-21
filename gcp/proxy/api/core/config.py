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


settings = Settings()

