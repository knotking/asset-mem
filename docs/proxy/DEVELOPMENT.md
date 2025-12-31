# GCP Proxy API - Development Guide

This document provides comprehensive instructions for local development, testing, and debugging of the GCP Proxy API.

## Prerequisites

### Required Software

- **Python 3.13+**
- **pip** (Python package manager)
- **Git**
- **Google Cloud SDK** (gcloud CLI)
- **Code Editor** (VS Code, PyCharm, etc.)

### Optional Tools

- **Docker** - For containerized development
- **Postman** or **Insomnia** - API testing
- **ngrok** or **VS Code Dev Tunnels** - For webhook testing

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/HomeApp.git
cd HomeApp/gcp/proxy/api
```

### 2. Create Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
# Install requirements
pip install -r requirements.txt

# Install development dependencies (optional)
pip install pytest pytest-asyncio httpx black flake8 mypy
```

### 4. Configure Environment Variables

Create `.env` file in `gcp/proxy/api/`:

```bash
# Copy example (if exists)
cp .env.example .env

# Or create new file
cat > .env << EOF
# GCP Configuration
GCP_PROJECT_ID=homegeekdemo
GCP_LOCATION=us-central1
REASONING_ENGINE_ID=your-reasoning-engine-id

# Webhook Secrets
FIREBASE_WEBHOOK_SECRET=dev-secret-$(openssl rand -hex 16)
TELEGRAM_WEBHOOK_SECRET=dev-secret-$(openssl rand -hex 16)

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# Pub/Sub
USER_UPLOAD_RESULT_SUBSCRIPTION=user-upload-result-subscription

# Development
LOG_LEVEL=DEBUG
ENVIRONMENT=development
EOF
```

### 5. Authenticate with Google Cloud

```bash
# Login to GCP
gcloud auth login

# Set project
gcloud config set project homegeekdemo

# Application default credentials (for local API calls)
gcloud auth application-default login
```

### 6. Verify Setup

```bash
# Check Python version
python --version  # Should be 3.13+

# Check dependencies
pip list

# Check GCP authentication
gcloud auth list

# Test environment variables
python -c "from core.config import settings; print(settings.GCP_PROJECT_ID)"
```

---

## Running the Server

### Development Server

```bash
cd gcp/proxy/api

# Run with auto-reload
uvicorn main:app --host=0.0.0.0 --port=8080 --reload

# Run with specific log level
uvicorn main:app --host=0.0.0.0 --port=8080 --reload --log-level debug
```

**Server will be available at:**
- API: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/docs`
- ReDoc: `http://localhost:8080/redoc`
- OpenAPI JSON: `http://localhost:8080/openapi.json`

### Production-like Server

```bash
# Run without auto-reload
uvicorn main:app --host=0.0.0.0 --port=8080

# Run with multiple workers (not recommended for development)
uvicorn main:app --host=0.0.0.0 --port=8080 --workers 4
```

### Docker Development

```bash
# Build image
docker build -t homecare-proxy:dev .

# Run container
docker run -p 8080:8080 \
  --env-file .env \
  homecare-proxy:dev

# Run with volume mount (for live reload)
docker run -p 8080:8080 \
  --env-file .env \
  -v $(pwd):/app \
  homecare-proxy:dev
```

---

## Project Structure

```
gcp/proxy/api/
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Python dependencies
├── Dockerfile             # Container definition
├── .env                   # Environment variables (local)
├── .gitignore            # Git ignore rules
│
├── core/                  # Core configuration
│   ├── config.py         # Settings and environment variables
│   └── events.py         # Lifecycle hooks (startup/shutdown)
│
├── routers/              # API route handlers
│   ├── __init__.py
│   ├── agent.py          # Agent query endpoints
│   ├── checkpoint.py     # Checkpoint processing
│   ├── documents.py      # Document analysis
│   ├── service_broker.py # Service broker webhook
│   └── telegram.py       # Telegram bot webhook
│
├── services/             # Business logic layer
│   ├── __init__.py
│   ├── agent_service.py       # Agent query processing
│   ├── checkpoint_service.py  # Checkpoint analysis
│   ├── document_service.py    # Document analysis
│   ├── vertex_service.py      # Vertex AI integration
│   ├── telegram_bot.py        # Telegram bot logic
│   └── service_broker_service.py
│
├── schemas/              # Pydantic data models
│   ├── __init__.py
│   ├── agent.py          # Agent request/response models
│   ├── checkpoint.py     # Checkpoint models
│   └── document.py       # Document models
│
├── utils/                # Utility functions
│   ├── gcp.py           # GCP client helpers
│   └── optional_agents.py
│
├── tests/                # Test files
│   ├── conftest.py      # Pytest configuration
│   ├── test_firebase.py
│   └── README.md
│
└── docs/                 # API documentation
    ├── ADDING_FUNCTIONS.md
    ├── DOCUMENT_ANALYSIS_API.md
    └── SERVICE_BROKER_API.md
```

---

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Edit files in your code editor. The development server will auto-reload on changes.

### 3. Test Changes

```bash
# Manual testing
curl http://localhost:8080/health

# Run tests
pytest

# Type checking
mypy .

# Linting
flake8 .

# Format code
black .
```

### 4. Commit Changes

```bash
git add .
git commit -m "Add feature: description"
git push origin feature/your-feature-name
```

### 5. Create Pull Request

Create PR on GitHub for code review.

---

## Testing

### Manual Testing

#### Health Check

```bash
curl http://localhost:8080/health
```

#### Agent Query

```bash
SECRET=$(grep FIREBASE_WEBHOOK_SECRET .env | cut -d '=' -f2)

curl -X POST "http://localhost:8080/${SECRET}/firebase-agent-query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Hello, how are you?",
    "user_id": "test_user_123"
  }'
```

#### Document Analysis

```bash
curl -X POST "http://localhost:8080/${SECRET}/extract-doc-info" \
  -H "Content-Type: application/json" \
  -d '{
    "docUrl": "https://storage.googleapis.com/test-bucket/sample.pdf",
    "contentType": "application/pdf"
  }'
```

#### Checkpoint Analysis

```bash
curl -X POST "http://localhost:8080/${SECRET}/analyze-checkpoint" \
  -H "Content-Type: application/json" \
  -d '{
    "checkpointId": "test_checkpoint_123",
    "userId": "test_user_123",
    "propertyId": "test_property_123",
    "imageUrl": "https://storage.googleapis.com/test-bucket/image.jpg",
    "contentType": "image/jpeg",
    "location": "Kitchen"
  }'
```

### Automated Testing

#### Unit Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_firebase.py

# Run with coverage
pytest --cov=. --cov-report=html

# Run with verbose output
pytest -v
```

#### Integration Tests

```bash
# Run integration tests
pytest tests/integration/

# Run with real GCP services (requires auth)
pytest tests/integration/ --use-real-services
```

### Test Structure

**Example test file:**

```python
# tests/test_agent.py
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@pytest.mark.asyncio
async def test_agent_query():
    response = client.post(
        f"/{settings.FIREBASE_WEBHOOK_SECRET}/firebase-agent-query",
        json={"query": "Hello", "user_id": "test"}
    )
    assert response.status_code == 200
    assert "response" in response.json()
```

---

## Debugging

### VS Code Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: FastAPI",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": [
        "main:app",
        "--reload",
        "--host",
        "0.0.0.0",
        "--port",
        "8080"
      ],
      "jinja": true,
      "justMyCode": false,
      "env": {
        "PYTHONPATH": "${workspaceFolder}/gcp/proxy/api"
      }
    }
  ]
}
```

### Logging

**Add debug logging:**

```python
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

@router.post("/endpoint")
async def handler(request_data: Schema):
    logger.debug(f"Received request: {request_data.model_dump_json()}")
    
    result = process_data(request_data)
    
    logger.debug(f"Processing result: {result}")
    
    return result
```

**View logs:**

```bash
# Tail logs in real-time
tail -f logs/app.log

# Filter logs
grep "ERROR" logs/app.log

# View structured logs
python -m json.tool logs/structured.log
```

### Interactive Debugging

**Using pdb:**

```python
import pdb

@router.post("/endpoint")
async def handler(request_data: Schema):
    pdb.set_trace()  # Breakpoint
    result = process_data(request_data)
    return result
```

**Using ipdb (enhanced debugger):**

```bash
pip install ipdb
```

```python
import ipdb

@router.post("/endpoint")
async def handler(request_data: Schema):
    ipdb.set_trace()  # Enhanced breakpoint
    result = process_data(request_data)
    return result
```

---

## Webhook Testing

### Using ngrok

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Start ngrok tunnel
ngrok http 8080

# Copy HTTPS URL (e.g., https://abc123.ngrok.io)
# Use this URL for webhook configuration
```

### Using VS Code Dev Tunnels

```bash
# Install VS Code CLI
# Already included in VS Code

# Start tunnel
code tunnel --accept-server-license-terms

# Use provided URL for webhooks
```

### Testing Telegram Webhook

```bash
# Set webhook to local tunnel
TELEGRAM_BOT_TOKEN="your-bot-token"
TELEGRAM_SECRET=$(grep TELEGRAM_WEBHOOK_SECRET .env | cut -d '=' -f2)
TUNNEL_URL="https://your-tunnel-url.ngrok.io"

curl -F "url=${TUNNEL_URL}/${TELEGRAM_SECRET}" \
     "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook"

# Test by sending message to bot
# Check server logs for incoming webhook
```

---

## Code Quality

### Formatting

```bash
# Format all Python files
black .

# Check formatting without changes
black --check .

# Format specific file
black main.py
```

### Linting

```bash
# Run flake8
flake8 .

# With specific rules
flake8 --max-line-length=100 --ignore=E203,W503 .
```

### Type Checking

```bash
# Run mypy
mypy .

# Check specific file
mypy main.py

# Strict mode
mypy --strict .
```

### Pre-commit Hooks

Install pre-commit hooks:

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

**`.pre-commit-config.yaml`:**

```yaml
repos:
  - repo: https://github.com/psf/black
    rev: 23.12.1
    hooks:
      - id: black
  
  - repo: https://github.com/pycqa/flake8
    rev: 7.0.0
    hooks:
      - id: flake8
  
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.8.0
    hooks:
      - id: mypy
```

---

## Performance Profiling

### Using cProfile

```python
import cProfile
import pstats

def profile_function():
    profiler = cProfile.Profile()
    profiler.enable()
    
    # Your code here
    result = expensive_operation()
    
    profiler.disable()
    stats = pstats.Stats(profiler)
    stats.sort_stats('cumulative')
    stats.print_stats(10)  # Top 10 functions
    
    return result
```

### Using line_profiler

```bash
pip install line_profiler
```

```python
from line_profiler import LineProfiler

@profile
def expensive_function():
    # Function code
    pass

# Run with kernprof
# kernprof -l -v script.py
```

---

## Common Development Tasks

### Adding a New Endpoint

See [Adding Endpoints Guide](./ADDING_ENDPOINTS.md) for detailed instructions.

**Quick steps:**

1. Define schema in `schemas/`
2. Implement service in `services/`
3. Create router in `routers/`
4. Register router in `main.py`
5. Add tests
6. Update documentation

### Updating Dependencies

```bash
# Update specific package
pip install --upgrade package-name

# Update all packages
pip list --outdated
pip install --upgrade package1 package2

# Freeze updated requirements
pip freeze > requirements.txt
```

### Database Migrations

```bash
# For Firestore schema changes
# Update data models in schemas/
# Create migration script if needed

python scripts/migrate_firestore.py
```

---

## Troubleshooting

### Common Issues

**1. Import errors**
```
Error: ModuleNotFoundError: No module named 'core'
Solution: Ensure you're in the correct directory and PYTHONPATH is set
```

**2. Authentication errors**
```
Error: Could not automatically determine credentials
Solution: Run `gcloud auth application-default login`
```

**3. Port already in use**
```
Error: Address already in use
Solution: Kill process on port 8080 or use different port
```

```bash
# Find process
lsof -i :8080

# Kill process
kill -9 <PID>

# Or use different port
uvicorn main:app --port 8081
```

**4. Environment variables not loaded**
```
Error: GCP_PROJECT_ID is required
Solution: Check .env file exists and python-dotenv is installed
```

### Debug Checklist

- [ ] Virtual environment activated
- [ ] Dependencies installed
- [ ] `.env` file exists and is valid
- [ ] GCP authentication configured
- [ ] Correct Python version (3.13+)
- [ ] No port conflicts
- [ ] Firestore database exists
- [ ] Service account has required permissions

---

## Best Practices

### Code Organization

1. **Separation of concerns** - Keep routers, services, and schemas separate
2. **DRY principle** - Don't repeat code, use utilities
3. **Type hints** - Use type annotations everywhere
4. **Docstrings** - Document all functions and classes

### Error Handling

1. **Specific exceptions** - Catch specific exceptions, not generic
2. **Logging** - Log errors with context
3. **User-friendly messages** - Return helpful error messages
4. **Graceful degradation** - Provide fallbacks when possible

### Testing

1. **Write tests first** - TDD approach
2. **Test coverage** - Aim for >80% coverage
3. **Mock external services** - Don't rely on real APIs in tests
4. **Integration tests** - Test full request/response cycle

### Security

1. **Never commit secrets** - Use `.env` and `.gitignore`
2. **Validate input** - Use Pydantic models
3. **Sanitize output** - Don't expose sensitive data
4. **Use HTTPS** - Even in development (with ngrok)

---

## Related Documentation

- [API Overview](./API_OVERVIEW.md)
- [Architecture](./ARCHITECTURE.md)
- [Configuration](./CONFIGURATION.md)
- [Deployment](./DEPLOYMENT.md)
- [Adding Endpoints](./ADDING_ENDPOINTS.md)

