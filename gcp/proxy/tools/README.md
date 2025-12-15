# E2E Client for HomeApp Proxy

A simple command-line interface to interact with the HomeApp Proxy API.

## Setup

1.  Ensure you have Python installed.
2.  Install dependencies (shared with API or install `httpx`):

    ```bash
    pip install httpx
    ```

## Usage

Run the client:

```bash
python3 gcp/proxy/tools/e2e_client.py
```

### Options

- `--url`: Base URL of the proxy (default: `http://localhost:8000`)
- `--secret`: Webhook secret (default: the dev secret)
- `--user-id`: User ID to simulate (default: `e2e-tester`)
- `--stream`: Use streaming endpoint by default
- `--debug`: Show debug information (payloads, URLs)

### Examples

**Connect to local instance:**

```bash
python3 gcp/proxy/tools/e2e_client.py
```

**Connect to a remote instance:**

```bash
python3 gcp/proxy/tools/e2e_client.py --url https://my-proxy-api.run.app --secret MY_SECRET
```

**Send a single query and exit:**

```bash
python3 gcp/proxy/tools/e2e_client.py "Hello, are you there?"
```

## Interactive Mode

If you don't provide a query argument, the tool enters interactive mode.

- Type your message and press Enter to send.
- Type `/stream on` or `/stream off` to toggle streaming mode.
- Type `exit` or `quit` to leave.

