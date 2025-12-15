# GCP Proxy API Testing

This directory contains the test suite for the GCP Proxy API.

## Prerequisites

Ensure you have the test dependencies installed:

```bash
cd gcp/proxy/api
pip install -r requirements.txt
```

This installs `pytest`, `pytest-asyncio`, and `httpx`.

## Running Tests

You can run the tests using the provided shell script or directly via `pytest`.

### Using the Script

```bash
./run_tests.sh
```

### Using Pytest Directly

Make sure you are in the `gcp/proxy/api` directory and set `PYTHONPATH`:

```bash
export PYTHONPATH=$PYTHONPATH:.
pytest tests/ -v
```

## Test Structure

- **`tests/conftest.py`**: Contains test fixtures, including the `TestClient` and global mocks for external services (Vertex AI, Firebase).
- **`tests/test_firebase.py`**: Tests for Firebase agent endpoints.
- **`tests/test_*.py`**: Add more test files here for other modules.

## Mocks

The tests rely on mocking external services to avoid hitting real endpoints or requiring credentials during testing. 
Check `conftest.py` for the mock definitions. 
Environment variables like `FIREBASE_WEBHOOK_SECRET` are also mocked in the `client` fixture.

