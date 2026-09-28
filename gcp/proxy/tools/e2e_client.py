import argparse
import json
import os
import sys
import httpx
from typing import Optional

# Default configuration
DEFAULT_BASE_URL = "http://localhost:8000"
# This is the secret used in local tests/default config, user can override
DEFAULT_SECRET = "92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376"

class E2EClient:
    def __init__(self, base_url: str, secret: str, user_id: str, debug: bool = False):
        self.base_url = base_url.rstrip('/')
        self.secret = secret
        self.user_id = user_id
        self.debug = debug
        self.session_id = ""
        self.client = httpx.Client(timeout=60.0)

    def _get_url(self, endpoint: str) -> str:
        # Endpoints are mounted at /{secret}/{endpoint}
        return f"{self.base_url}/{self.secret}/{endpoint}"

    def health_check(self):
        url = f"{self.base_url}/health"
        try:
            resp = self.client.get(url)
            print(f"Health Check: {resp.status_code} - {resp.text}")
            return resp.status_code == 200
        except Exception as e:
            print(f"Health Check Failed: {e}")
            return False

    def query(self, text: str, stream: bool = False):
        endpoint = "firebase-agent-stream" if stream else "firebase-agent-query"
        url = self._get_url(endpoint)
        
        payload = {
            "user_id": self.user_id,
            "user_query": text,
            "session_id": self.session_id,
            # Add defaults for other fields to match AgentRequest schema
            "context_doc_uris": [],
            "property_address": "",
        }

        if self.debug:
            print(f"DEBUG: Sending to {url}")
            print(f"DEBUG: Payload: {json.dumps(payload, indent=2)}")

        try:
            if stream:
                print("--- Streaming Response ---")
                with self.client.stream("POST", url, json=payload) as response:
                    if response.status_code != 200:
                        print(f"Error: {response.status_code}")
                        print(response.read().decode())
                        return

                    for line in response.iter_lines():
                        if line:
                            print(line)
                print("\n--- End Stream ---")
            else:
                response = self.client.post(url, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    print("--- Response ---")
                    print(json.dumps(data, indent=2))
                    # Update session_id if provided in response (though API doesn't seem to return it in the main body directly in all cases, mostly logic handled on server)
                else:
                    print(f"Error: {response.status_code}")
                    print(response.text)

        except Exception as e:
            print(f"Request Failed: {e}")

    def create_session(self):
        url = self._get_url("agent-session")
        payload = {"user_id": self.user_id}
        try:
            resp = self.client.post(url, json=payload)
            if resp.status_code == 200:
                print("Session Created/Refreshed")
                # The response might contain session details
                print(resp.json())
            else:
                print(f"Failed to create session: {resp.text}")
        except Exception as e:
            print(f"Session Create Failed: {e}")

def main():
    parser = argparse.ArgumentParser(description="AssetMem Proxy E2E Client")
    parser.add_argument("--url", default=os.environ.get("PROXY_URL", DEFAULT_BASE_URL), help="Base URL of the proxy")
    parser.add_argument("--secret", default=os.environ.get("WEBHOOK_SECRET", DEFAULT_SECRET), help="Webhook secret for auth")
    parser.add_argument("--user-id", default="e2e-tester", help="User ID for the session")
    parser.add_argument("--stream", action="store_true", help="Use streaming endpoint by default")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    parser.add_argument("query", nargs="?", help="Initial query to send (optional)")

    args = parser.parse_args()

    client = E2EClient(args.url, args.secret, args.user_id, args.debug)

    print(f"Connecting to {args.url} with User ID: {args.user_id}")
    if not client.health_check():
        print("Warning: Health check failed. Proceeding anyway...")

    # Interactive mode if no query provided
    if args.query:
        client.query(args.query, stream=args.stream)
    else:
        print("\nEntering interactive mode. Type 'exit' or 'quit' to stop.")
        print("Commands: /stream [on|off] to toggle streaming.")
        
        streaming = args.stream
        while True:
            try:
                prompt = f"({args.user_id}) [{'stream' if streaming else 'query'}] > "
                user_input = input(prompt)
                
                if user_input.lower() in ('exit', 'quit'):
                    break
                
                if not user_input.strip():
                    continue

                if user_input.startswith("/stream"):
                    parts = user_input.split()
                    if len(parts) > 1:
                        if parts[1] == "on": streaming = True
                        elif parts[1] == "off": streaming = False
                    else:
                        streaming = not streaming
                    print(f"Streaming is now {'ON' if streaming else 'OFF'}")
                    continue

                client.query(user_input, stream=streaming)

            except KeyboardInterrupt:
                print("\nExiting...")
                break
            except Exception as e:
                print(f"Error: {e}")

if __name__ == "__main__":
    main()

