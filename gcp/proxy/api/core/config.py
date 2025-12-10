import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET")
    FIREBASE_WEBHOOK_SECRET = os.environ.get("FIREBASE_WEBHOOK_SECRET")
    GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
    USER_UPLOAD_RESULT_SUBSCRIPTION = os.environ.get("USER_UPLOAD_RESULT_SUBSCRIPTION")

settings = Settings()

