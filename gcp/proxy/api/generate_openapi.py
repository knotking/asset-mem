import json
import argparse
import os
from unittest.mock import MagicMock
import sys

# Mock environment variables to avoid validation errors
os.environ["TELEGRAM_BOT_TOKEN"] = "123456789:ABCDefghIJKLmnOPQRstUVwxyz"
os.environ["FIREBASE_WEBHOOK_SECRET"] = "mock_secret"
os.environ["TELEGRAM_WEBHOOK_SECRET"] = "mock_telegram_secret"
os.environ["GCP_PROJECT_ID"] = "mock-project"
os.environ["GCP_REGION"] = "us-central1"
# Skip Vertex client init during OpenAPI generation (no GCP credentials required).
os.environ["REASONING_ENGINE_ID"] = ""

# Mock aiogram Bot to avoid connection attempts or validation errors
sys.modules["aiogram"] = MagicMock()
sys.modules["aiogram.client"] = MagicMock()
sys.modules["aiogram.client.default"] = MagicMock()
sys.modules["aiogram.client.bot"] = MagicMock()
sys.modules["aiogram.enums"] = MagicMock()
sys.modules["aiogram.filters"] = MagicMock()
sys.modules["aiogram.types"] = MagicMock()

# We need to selectively mock parts of aiogram because some parts are used for type hinting or logic
# It's better to let the real import happen but patch the Bot class if possible.
# However, since the Bot is instantiated at module level, we must set env var BEFORE import.

from fastapi.openapi.utils import get_openapi
# Import main after setting env vars
try:
    from main import app
except Exception as e:
    print(f"Error importing app: {e}")
    # Try to patch aiogram.Bot if the import failed due to validation
    import aiogram
    aiogram.Bot = MagicMock()
    from main import app

def generate_openapi_spec(output_file: str):
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        routes=app.routes,
    )
    
    if output_file.endswith(('.yaml', '.yml')):
        import yaml

        with open(output_file, "w") as f:
            yaml.dump(openapi_schema, f, sort_keys=False)
    else:
        with open(output_file, "w") as f:
            json.dump(openapi_schema, f, indent=2)
    
    print(f"OpenAPI spec generated at {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate OpenAPI spec")
    parser.add_argument("--output", default="openapi.yaml", help="Output file path (json or yaml)")
    args = parser.parse_args()
    
    generate_openapi_spec(args.output)

