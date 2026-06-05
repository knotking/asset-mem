import os
import sys
import unittest

function_dir = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "function", "user_docs")
)
if function_dir not in sys.path:
    sys.path.insert(0, function_dir)

from rag_import_result import evaluate_rag_import_result


class TestEvaluateRagImportResult(unittest.TestCase):
    def test_success_imported(self):
        ok, msg = evaluate_rag_import_result(
            {
                "document_import_result": {
                    "imported_rag_files_count": 1,
                    "failed_rag_files_count": 0,
                    "skipped_rag_files_count": 0,
                },
                "media_import_result": {},
            },
            1,
        )
        self.assertTrue(ok)
        self.assertIn("imported=1", msg)

    def test_success_skipped_counts_as_indexed(self):
        ok, _ = evaluate_rag_import_result(
            {
                "document_import_result": {
                    "imported_rag_files_count": 0,
                    "failed_rag_files_count": 0,
                    "skipped_rag_files_count": 1,
                },
                "media_import_result": {},
            },
            1,
        )
        self.assertTrue(ok)

    def test_failure_when_failed_count(self):
        ok, msg = evaluate_rag_import_result(
            {
                "document_import_result": {
                    "imported_rag_files_count": 0,
                    "failed_rag_files_count": 1,
                },
            },
            1,
        )
        self.assertFalse(ok)
        self.assertIn("failed", msg)

    def test_failure_incomplete(self):
        ok, msg = evaluate_rag_import_result(
            {
                "document_import_result": {
                    "imported_rag_files_count": 0,
                    "failed_rag_files_count": 0,
                    "skipped_rag_files_count": 0,
                },
            },
            2,
        )
        self.assertFalse(ok)
        self.assertIn("incomplete", msg)


if __name__ == "__main__":
    unittest.main()
