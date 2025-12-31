# GCP Proxy API - Configuration Guide

This document describes all configuration options and environment variables for the GCP Proxy API.

## Environment Variables

### Required Variables

These variables must be set for the API to function:

#### GCP_PROJECT_ID
- **Description:** Google Cloud Project ID
- **Example:** `homegeekdemo`
- **Required for:** All GCP service integrations
- **Default:** None (must be set)

```bash
GCP_PROJECT_ID=homegeekdemo
```

#### FIREBASE_WEBHOOK_SECRET
- **Description:** Secret token for Firebase/agent endpoints
- **Example:** `92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376`
- **Required for:** Agent, document, checkpoint, service broker endpoints
- **Generation:** `openssl rand -hex 32`
- **Default:** None (endpoints not mounted if missing)

```bash
FIREBASE_WEBHOOK_SECRET=your-secret-here
```

**Endpoint Pattern:**
```
POST /{FIREBASE_WEBHOOK_SECRET}/firebase-agent-query
POST /{FIREBASE_WEBHOOK_SECRET}/extract-doc-info
POST /{FIREBASE_WEBHOOK_SECRET}/analyze-checkpoint
```

---

### Optional Variables

#### GCP_LOCATION
- **Description:** Google Cloud region for Vertex AI
- **Example:** `us-central1`
- **Required for:** Vertex AI Reasoning Engine, Gemini AI
- **Default:** `us-central1`

```bash
GCP_LOCATION=us-central1
```

**Supported Regions:**
- `us-central1` (Iowa)
- `us-east1` (South Carolina)
- `us-west1` (Oregon)
- `europe-west1` (Belgium)
- `asia-northeast1` (Tokyo)

#### REASONING_ENGINE_ID
- **Description:** Vertex AI Reasoning Engine resource ID
- **Example:** `1582298387439419392`
- **Required for:** Agent query and streaming endpoints
- **Default:** None (Reasoning Engine not initialized)

```bash
REASONING_ENGINE_ID=1582298387439419392
```

**How to find:**
```bash
gcloud ai reasoning-engines list --region=us-central1
```

#### TELEGRAM_WEBHOOK_SECRET
- **Description:** Secret token for Telegram webhook endpoint
- **Example:** `92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376`
- **Required for:** Telegram bot integration
- **Generation:** `openssl rand -hex 32`
- **Default:** None (Telegram endpoint not mounted)

```bash
TELEGRAM_WEBHOOK_SECRET=your-telegram-secret
```

#### TELEGRAM_BOT_TOKEN
- **Description:** Telegram Bot API token from BotFather
- **Example:** `8143678514:AAFPdoMF470JfQ9qmVEJOLSqBe4uaN5yx7s`
- **Required for:** Telegram bot functionality
- **Default:** None

```bash
TELEGRAM_BOT_TOKEN=your-bot-token
```

**How to get:**
1. Talk to [@BotFather](https://t.me/BotFather) on Telegram
2. Use `/newbot` command
3. Copy the provided token

#### USER_UPLOAD_RESULT_SUBSCRIPTION
- **Description:** Pub/Sub subscription name for checkpoint analysis results
- **Example:** `user-upload-result-subscription`
- **Required for:** Checkpoint analysis async processing
- **Default:** None

```bash
USER_UPLOAD_RESULT_SUBSCRIPTION=user-upload-result-subscription
```

---

## Configuration Files

### .env File (Local Development)

Create a `.env` file in `gcp/proxy/api/`:

```bash
# GCP Configuration
GCP_PROJECT_ID=homegeekdemo
GCP_LOCATION=us-central1
REASONING_ENGINE_ID=1582298387439419392

# Webhook Secrets
FIREBASE_WEBHOOK_SECRET=92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376
TELEGRAM_WEBHOOK_SECRET=92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376

# Telegram Bot
TELEGRAM_BOT_TOKEN=8143678514:AAFPdoMF470JfQ9qmVEJOLSqBe4uaN5yx7s

# Pub/Sub
USER_UPLOAD_RESULT_SUBSCRIPTION=user-upload-result-subscription

# Optional: Development settings
LOG_LEVEL=DEBUG
```

**Usage:**
```bash
# Load automatically with python-dotenv
uvicorn main:app --reload
```

### env.yaml (Cloud Run Deployment)

Create `env.yaml` for Cloud Run deployment:

```yaml
GCP_PROJECT_ID: "homegeekdemo"
GCP_LOCATION: "us-central1"
REASONING_ENGINE_ID: "1582298387439419392"
FIREBASE_WEBHOOK_SECRET: "your-firebase-secret"
TELEGRAM_WEBHOOK_SECRET: "your-telegram-secret"
TELEGRAM_BOT_TOKEN: "your-telegram-bot-token"
USER_UPLOAD_RESULT_SUBSCRIPTION: "user-upload-result-subscription"
```

**Usage:**
```bash
gcloud run deploy homecare-agent-proxy \
  --env-vars-file env.yaml
```

---

## Configuration Loading

### Settings Class

**File:** `core/config.py`

```python
import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET")
    FIREBASE_WEBHOOK_SECRET = os.environ.get("FIREBASE_WEBHOOK_SECRET")
    GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
    USER_UPLOAD_RESULT_SUBSCRIPTION = os.environ.get("USER_UPLOAD_RESULT_SUBSCRIPTION")

settings = Settings()
```

### Usage in Code

```python
from core.config import settings

project_id = settings.GCP_PROJECT_ID
webhook_secret = settings.FIREBASE_WEBHOOK_SECRET
```

---

## Environment-Specific Configuration

### Development Environment

```bash
# .env.development
GCP_PROJECT_ID=homegeekdemo-dev
GCP_LOCATION=us-central1
REASONING_ENGINE_ID=dev-reasoning-engine-id
FIREBASE_WEBHOOK_SECRET=dev-secret
LOG_LEVEL=DEBUG
```

**Load specific environment:**
```bash
cp .env.development .env
uvicorn main:app --reload
```

### Staging Environment

```bash
# .env.staging
GCP_PROJECT_ID=homegeekdemo-staging
GCP_LOCATION=us-central1
REASONING_ENGINE_ID=staging-reasoning-engine-id
FIREBASE_WEBHOOK_SECRET=staging-secret
LOG_LEVEL=INFO
```

**Deploy to staging:**
```bash
gcloud run deploy homecare-agent-proxy-staging \
  --env-vars-file .env.staging
```

### Production Environment

```bash
# .env.production
GCP_PROJECT_ID=homegeekdemo
GCP_LOCATION=us-central1
REASONING_ENGINE_ID=prod-reasoning-engine-id
FIREBASE_WEBHOOK_SECRET=prod-secret
LOG_LEVEL=WARNING
```

**Deploy to production:**
```bash
gcloud run deploy homecare-agent-proxy \
  --env-vars-file .env.production
```

---

## Secret Management

### Using Google Secret Manager (Recommended)

**Create secrets:**
```bash
# Create secret
echo -n "your-secret-value" | \
  gcloud secrets create firebase-webhook-secret \
  --data-file=-

# Grant access to service account
gcloud secrets add-iam-policy-binding firebase-webhook-secret \
  --member="serviceAccount:YOUR-SA@PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Deploy with secrets:**
```bash
gcloud run deploy homecare-agent-proxy \
  --update-secrets=FIREBASE_WEBHOOK_SECRET=firebase-webhook-secret:latest \
  --update-secrets=TELEGRAM_BOT_TOKEN=telegram-bot-token:latest
```

**Advantages:**
- Centralized secret management
- Automatic rotation support
- Audit logging
- IAM-based access control

---

## Validation

### Check Configuration

Add validation to `core/config.py`:

```python
class Settings:
    def __init__(self):
        self.GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
        self.FIREBASE_WEBHOOK_SECRET = os.environ.get("FIREBASE_WEBHOOK_SECRET")
        
        # Validate required variables
        if not self.GCP_PROJECT_ID:
            raise ValueError("GCP_PROJECT_ID is required")
    
    def validate(self):
        """Validate configuration"""
        errors = []
        
        if not self.GCP_PROJECT_ID:
            errors.append("GCP_PROJECT_ID is required")
        
        if not self.FIREBASE_WEBHOOK_SECRET:
            errors.append("FIREBASE_WEBHOOK_SECRET is required")
        
        if errors:
            raise ValueError(f"Configuration errors: {', '.join(errors)}")
        
        return True

settings = Settings()
```

### Startup Validation

In `core/events.py`:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Validating configuration...")
    settings.validate()
    logger.info("Configuration valid")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
```

---

## Feature Flags

### Optional Features

Control feature availability via environment variables:

```python
class Settings:
    # Feature flags
    ENABLE_TELEGRAM = bool(os.environ.get("TELEGRAM_WEBHOOK_SECRET"))
    ENABLE_AGENT = bool(os.environ.get("FIREBASE_WEBHOOK_SECRET"))
    ENABLE_REASONING_ENGINE = bool(os.environ.get("REASONING_ENGINE_ID"))
```

### Conditional Router Mounting

In `main.py`:

```python
# Mount routers conditionally
if settings.FIREBASE_WEBHOOK_SECRET:
    prefix = f"/{settings.FIREBASE_WEBHOOK_SECRET}"
    app.include_router(agent.router, prefix=prefix)
    logger.info(f"Mounted agent router at {prefix}")
else:
    logger.warning("FIREBASE_WEBHOOK_SECRET not set, agent endpoints not mounted.")

if settings.TELEGRAM_WEBHOOK_SECRET:
    prefix = f"/{settings.TELEGRAM_WEBHOOK_SECRET}"
    app.include_router(telegram.router, prefix=prefix)
    logger.info(f"Mounted telegram router at {prefix}")
else:
    logger.warning("TELEGRAM_WEBHOOK_SECRET not set, telegram endpoint not mounted.")
```

---

## Logging Configuration

### Log Levels

```bash
# Environment variable
LOG_LEVEL=DEBUG  # DEBUG, INFO, WARNING, ERROR, CRITICAL
```

### Configure in Code

```python
import logging
import os

log_level = os.environ.get("LOG_LEVEL", "INFO")
logging.basicConfig(
    level=getattr(logging, log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

---

## CORS Configuration

### Development

Allow all origins for development:

```python
# main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Production

Restrict to specific origins:

```python
# Environment variable
ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com

# main.py
import os

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
```

---

## Performance Configuration

### FastAPI Settings

```python
app = FastAPI(
    title="HomeApp Proxy API",
    description="API for handling HomeApp proxy requests",
    version="1.0.0",
    docs_url="/docs" if os.environ.get("ENABLE_DOCS") else None,
    redoc_url="/redoc" if os.environ.get("ENABLE_DOCS") else None,
)
```

### Uvicorn Settings

```bash
# Development
uvicorn main:app \
  --host 0.0.0.0 \
  --port 8080 \
  --reload \
  --log-level debug

# Production (Cloud Run handles this)
uvicorn main:app \
  --host 0.0.0.0 \
  --port $PORT \
  --workers 1 \
  --log-level info
```

---

## Troubleshooting

### Check Current Configuration

```python
# Add debug endpoint (development only)
@app.get("/debug/config")
async def debug_config():
    if os.environ.get("ENVIRONMENT") != "development":
        raise HTTPException(status_code=404)
    
    return {
        "GCP_PROJECT_ID": settings.GCP_PROJECT_ID,
        "GCP_LOCATION": os.environ.get("GCP_LOCATION", "us-central1"),
        "FIREBASE_SECRET_SET": bool(settings.FIREBASE_WEBHOOK_SECRET),
        "TELEGRAM_SECRET_SET": bool(settings.TELEGRAM_WEBHOOK_SECRET),
        "REASONING_ENGINE_SET": bool(os.environ.get("REASONING_ENGINE_ID")),
    }
```

### Common Issues

**1. Variable not loaded**
```
Issue: Environment variable not recognized
Solution: Check .env file exists and is in correct directory
```

**2. Secret not found**
```
Issue: Secret Manager secret not accessible
Solution: Verify service account has secretAccessor role
```

**3. Wrong environment**
```
Issue: Using production secrets in development
Solution: Use separate .env files per environment
```

---

## Best Practices

### Security

1. **Never commit secrets** - Use `.gitignore` for `.env` files
2. **Use Secret Manager** - For production environments
3. **Rotate secrets regularly** - Update webhook secrets periodically
4. **Least privilege** - Grant minimum required permissions

### Organization

1. **Separate environments** - Use different configs for dev/staging/prod
2. **Document variables** - Add comments explaining each variable
3. **Validate on startup** - Fail fast if configuration is invalid
4. **Use defaults** - Provide sensible defaults where possible

### Maintenance

1. **Version control** - Track configuration changes
2. **Audit access** - Monitor who accesses secrets
3. **Update documentation** - Keep this guide current
4. **Test configuration** - Verify after changes

---

## Configuration Checklist

Before deploying, verify:

- [ ] `GCP_PROJECT_ID` is set correctly
- [ ] `FIREBASE_WEBHOOK_SECRET` is generated and set
- [ ] `REASONING_ENGINE_ID` is valid (if using agent features)
- [ ] `TELEGRAM_BOT_TOKEN` is set (if using Telegram)
- [ ] `TELEGRAM_WEBHOOK_SECRET` is generated (if using Telegram)
- [ ] Service account has required IAM roles
- [ ] Pub/Sub topics and subscriptions exist
- [ ] Cloud Storage bucket is created
- [ ] Secrets are stored securely
- [ ] CORS origins are restricted (production)
- [ ] Log level is appropriate for environment

---

## Related Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [Development Guide](./DEVELOPMENT.md)
- [Architecture](./ARCHITECTURE.md)
- [API Overview](./API_OVERVIEW.md)

