#!/usr/bin/env python3
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
End-to-End Integration Tests for File Search API

This script performs real API calls to test the complete File Search workflow.
Run against a local or deployed API server.

Prerequisites:
    - API server running (locally or deployed)
    - Valid authentication token
    - Test documents in GCS or local filesystem

Usage:
    # Against local server
    python e2e_file_search_test.py --base-url http://localhost:8000

    # Against staging
    python e2e_file_search_test.py --base-url https://staging-api.homeapp.example.com --token YOUR_TOKEN

    # With verbose output
    python e2e_file_search_test.py --verbose

    # Run specific tests
    python e2e_file_search_test.py --test store --test upload
"""

import os
import sys
import json
import time
import argparse
import requests
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime

# Add colors for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


@dataclass
class TestResult:
    """Result of a single test."""
    name: str
    passed: bool
    duration_ms: int
    error: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class FileSearchE2ETests:
    """End-to-end tests for File Search API."""
    
    def __init__(
        self,
        base_url: str,
        auth_token: Optional[str] = None,
        verbose: bool = False,
        test_user_id: str = "e2e-test-user"
    ):
        self.base_url = base_url.rstrip('/')
        self.auth_token = auth_token
        self.verbose = verbose
        self.test_user_id = test_user_id
        self.results: List[TestResult] = []
        
        # Track resources for cleanup
        self.created_stores: List[str] = []
        self.created_documents: List[str] = []
        
        # Test data
        self.test_store_name: Optional[str] = None
        self.test_document_name: Optional[str] = None
    
    def _headers(self) -> Dict[str, str]:
        """Get request headers."""
        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        return headers
    
    def _log(self, message: str, level: str = "info"):
        """Log a message."""
        if not self.verbose and level == "debug":
            return
        
        timestamp = datetime.now().strftime("%H:%M:%S")
        color = {
            "info": Colors.CYAN,
            "debug": Colors.BLUE,
            "success": Colors.GREEN,
            "warning": Colors.WARNING,
            "error": Colors.FAIL,
        }.get(level, "")
        
        print(f"{color}[{timestamp}] {message}{Colors.ENDC}")
    
    def _run_test(self, name: str, test_func) -> TestResult:
        """Run a test function and record the result."""
        self._log(f"Running: {name}", "info")
        start_time = time.time()
        
        try:
            details = test_func()
            duration_ms = int((time.time() - start_time) * 1000)
            result = TestResult(
                name=name,
                passed=True,
                duration_ms=duration_ms,
                details=details
            )
            self._log(f"  ✓ Passed ({duration_ms}ms)", "success")
            
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            result = TestResult(
                name=name,
                passed=False,
                duration_ms=duration_ms,
                error=str(e)
            )
            self._log(f"  ✗ Failed: {e}", "error")
        
        self.results.append(result)
        return result
    
    # =========================================================================
    # Health Check Tests
    # =========================================================================
    
    def test_health_check(self) -> Dict[str, Any]:
        """Test the health check endpoint."""
        response = requests.get(
            f"{self.base_url}/file-search/health",
            headers=self._headers(),
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        assert data["status"] == "healthy", f"Unexpected status: {data['status']}"
        assert data["service"] == "file-search", f"Unexpected service: {data['service']}"
        
        return data
    
    # =========================================================================
    # Store Tests
    # =========================================================================
    
    def test_create_store(self) -> Dict[str, Any]:
        """Test creating a FileSearchStore."""
        payload = {
            "display_name": f"E2E Test Store {datetime.now().isoformat()}",
            "description": "Store created by e2e tests",
            "user_id": self.test_user_id,
        }
        
        response = requests.post(
            f"{self.base_url}/file-search/stores",
            headers=self._headers(),
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        
        assert "store" in data, "Response missing 'store' field"
        assert data["store"]["name"], "Store name is empty"
        
        # Save for later tests
        self.test_store_name = data["store"]["name"]
        self.created_stores.append(self.test_store_name)
        
        return data
    
    def test_get_store(self) -> Dict[str, Any]:
        """Test getting a store by ID."""
        if not self.test_store_name:
            raise RuntimeError("No store created yet - run test_create_store first")
        
        store_id = self.test_store_name.split("/")[-1]
        response = requests.get(
            f"{self.base_url}/file-search/stores/{store_id}",
            headers=self._headers(),
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        assert data["name"] == self.test_store_name, "Store name mismatch"
        
        return data
    
    def test_list_stores(self) -> Dict[str, Any]:
        """Test listing stores."""
        response = requests.get(
            f"{self.base_url}/file-search/stores",
            headers=self._headers(),
            params={"page_size": 10},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        
        assert "stores" in data, "Response missing 'stores' field"
        assert isinstance(data["stores"], list), "'stores' is not a list"
        
        return {"count": len(data["stores"])}
    
    def test_list_user_stores(self) -> Dict[str, Any]:
        """Test listing stores for a specific user."""
        response = requests.get(
            f"{self.base_url}/file-search/users/{self.test_user_id}/stores",
            headers=self._headers(),
            params={"page_size": 10},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        
        assert "stores" in data, "Response missing 'stores' field"
        
        return {"count": len(data["stores"])}
    
    # =========================================================================
    # Document Tests
    # =========================================================================
    
    def test_upload_document_from_uri(self) -> Dict[str, Any]:
        """Test uploading a document from a URI."""
        if not self.test_store_name:
            raise RuntimeError("No store created yet")
        
        store_id = self.test_store_name.split("/")[-1]
        
        # Use a publicly accessible test document
        # In real tests, use a document in your GCS bucket
        payload = {
            "store_name": self.test_store_name,
            "uri": "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.jpg",  # Small test file
            "display_name": "E2E Test Document",
            "description": "Document uploaded by e2e tests",
            "mime_type": "image/jpeg",
        }
        
        response = requests.post(
            f"{self.base_url}/file-search/stores/{store_id}/documents",
            headers=self._headers(),
            json=payload,
            timeout=120  # Document processing can take time
        )
        
        if response.status_code != 200:
            self._log(f"Upload response: {response.text}", "debug")
        
        response.raise_for_status()
        data = response.json()
        
        assert data["result"]["success"], "Upload was not successful"
        
        self.test_document_name = data["result"]["document"]["name"]
        self.created_documents.append(self.test_document_name)
        
        return data
    
    def test_list_documents(self) -> Dict[str, Any]:
        """Test listing documents in a store."""
        if not self.test_store_name:
            raise RuntimeError("No store created yet")
        
        store_id = self.test_store_name.split("/")[-1]
        response = requests.get(
            f"{self.base_url}/file-search/stores/{store_id}/documents",
            headers=self._headers(),
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        
        assert "documents" in data, "Response missing 'documents' field"
        
        return {"count": len(data["documents"])}
    
    # =========================================================================
    # Query Tests
    # =========================================================================
    
    def test_query_with_file_search(self) -> Dict[str, Any]:
        """Test querying with file search grounding."""
        if not self.test_store_name:
            raise RuntimeError("No store created yet")
        
        payload = {
            "query": "Describe the content of the uploaded document.",
            "store_names": [self.test_store_name],
            "model": "gemini-2.5-flash",
            "temperature": 0.7,
            "max_output_tokens": 1024,
            "include_citations": True,
        }
        
        response = requests.post(
            f"{self.base_url}/file-search/query",
            headers=self._headers(),
            json=payload,
            timeout=60
        )
        response.raise_for_status()
        data = response.json()
        
        assert "result" in data, "Response missing 'result' field"
        assert data["result"]["text"], "Generated text is empty"
        assert data["result"]["model"], "Model field is empty"
        
        return {
            "text_length": len(data["result"]["text"]),
            "model": data["result"]["model"],
            "has_citations": data["result"].get("grounding_metadata") is not None,
        }
    
    def test_streaming_query(self) -> Dict[str, Any]:
        """Test streaming query endpoint."""
        if not self.test_store_name:
            raise RuntimeError("No store created yet")
        
        payload = {
            "query": "Briefly describe the document.",
            "store_names": [self.test_store_name],
        }
        
        response = requests.post(
            f"{self.base_url}/file-search/query/stream",
            headers=self._headers(),
            json=payload,
            stream=True,
            timeout=60
        )
        response.raise_for_status()
        
        chunks = []
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data: '):
                    data = line_str[6:]
                    if data != '[DONE]':
                        chunks.append(data)
        
        assert len(chunks) > 0, "No chunks received from stream"
        
        return {"chunk_count": len(chunks)}
    
    # =========================================================================
    # Cleanup Tests
    # =========================================================================
    
    def test_delete_document(self) -> Dict[str, Any]:
        """Test deleting a document."""
        if not self.test_document_name:
            self._log("No document to delete, skipping", "warning")
            return {"skipped": True}
        
        # Parse document name
        parts = self.test_document_name.split("/")
        if len(parts) >= 4:
            store_id = parts[1]
            document_id = parts[3]
        else:
            raise ValueError(f"Invalid document name: {self.test_document_name}")
        
        response = requests.delete(
            f"{self.base_url}/file-search/stores/{store_id}/documents/{document_id}",
            headers=self._headers(),
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        
        assert data["status"] == "success", f"Delete failed: {data}"
        
        return data
    
    def test_delete_store(self) -> Dict[str, Any]:
        """Test deleting a store."""
        if not self.test_store_name:
            self._log("No store to delete, skipping", "warning")
            return {"skipped": True}
        
        store_id = self.test_store_name.split("/")[-1]
        response = requests.delete(
            f"{self.base_url}/file-search/stores/{store_id}",
            headers=self._headers(),
            params={"force": "true"},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        
        assert data["status"] == "success", f"Delete failed: {data}"
        
        return data
    
    # =========================================================================
    # Test Runner
    # =========================================================================
    
    def run_all_tests(self, tests: Optional[List[str]] = None):
        """Run all tests or a subset."""
        all_tests = [
            ("Health Check", self.test_health_check),
            ("Create Store", self.test_create_store),
            ("Get Store", self.test_get_store),
            ("List Stores", self.test_list_stores),
            ("List User Stores", self.test_list_user_stores),
            ("Upload Document", self.test_upload_document_from_uri),
            ("List Documents", self.test_list_documents),
            ("Query with File Search", self.test_query_with_file_search),
            ("Streaming Query", self.test_streaming_query),
            ("Delete Document", self.test_delete_document),
            ("Delete Store", self.test_delete_store),
        ]
        
        # Filter tests if specified
        if tests:
            test_names_lower = [t.lower() for t in tests]
            all_tests = [
                (name, func) for name, func in all_tests
                if any(t in name.lower() for t in test_names_lower)
            ]
        
        print(f"\n{Colors.HEADER}{'='*60}")
        print(f"File Search E2E Tests")
        print(f"Base URL: {self.base_url}")
        print(f"User ID: {self.test_user_id}")
        print(f"{'='*60}{Colors.ENDC}\n")
        
        for name, test_func in all_tests:
            self._run_test(name, test_func)
        
        self._print_summary()
    
    def _print_summary(self):
        """Print test summary."""
        passed = sum(1 for r in self.results if r.passed)
        failed = sum(1 for r in self.results if not r.passed)
        total_time = sum(r.duration_ms for r in self.results)
        
        print(f"\n{Colors.HEADER}{'='*60}")
        print(f"Test Summary")
        print(f"{'='*60}{Colors.ENDC}")
        
        for result in self.results:
            status = f"{Colors.GREEN}✓ PASS{Colors.ENDC}" if result.passed else f"{Colors.FAIL}✗ FAIL{Colors.ENDC}"
            print(f"  {status} {result.name} ({result.duration_ms}ms)")
            if result.error:
                print(f"       Error: {result.error}")
        
        print(f"\n{Colors.BOLD}Results: {passed} passed, {failed} failed ({total_time}ms){Colors.ENDC}")
        
        if failed > 0:
            print(f"\n{Colors.FAIL}Some tests failed!{Colors.ENDC}")
            sys.exit(1)
        else:
            print(f"\n{Colors.GREEN}All tests passed!{Colors.ENDC}")
    
    def cleanup(self):
        """Clean up test resources."""
        self._log("Cleaning up test resources...", "info")
        
        # Clean up documents
        for doc_name in self.created_documents:
            try:
                parts = doc_name.split("/")
                if len(parts) >= 4:
                    store_id, doc_id = parts[1], parts[3]
                    requests.delete(
                        f"{self.base_url}/file-search/stores/{store_id}/documents/{doc_id}",
                        headers=self._headers(),
                        timeout=10
                    )
            except Exception as e:
                self._log(f"Failed to cleanup document {doc_name}: {e}", "warning")
        
        # Clean up stores
        for store_name in self.created_stores:
            try:
                store_id = store_name.split("/")[-1]
                requests.delete(
                    f"{self.base_url}/file-search/stores/{store_id}",
                    headers=self._headers(),
                    params={"force": "true"},
                    timeout=10
                )
            except Exception as e:
                self._log(f"Failed to cleanup store {store_name}: {e}", "warning")


def main():
    parser = argparse.ArgumentParser(description="File Search E2E Tests")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("API_BASE_URL", "http://localhost:8000"),
        help="API base URL"
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("AUTH_TOKEN"),
        help="Authentication token"
    )
    parser.add_argument(
        "--user-id",
        default="e2e-test-user",
        help="Test user ID"
    )
    parser.add_argument(
        "--test",
        action="append",
        dest="tests",
        help="Specific tests to run (can be repeated)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )
    parser.add_argument(
        "--no-cleanup",
        action="store_true",
        help="Don't cleanup test resources after running"
    )
    
    args = parser.parse_args()
    
    runner = FileSearchE2ETests(
        base_url=args.base_url,
        auth_token=args.token,
        verbose=args.verbose,
        test_user_id=args.user_id
    )
    
    try:
        runner.run_all_tests(args.tests)
    finally:
        if not args.no_cleanup:
            runner.cleanup()


if __name__ == "__main__":
    main()

