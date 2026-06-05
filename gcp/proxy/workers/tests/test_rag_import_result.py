import os
import sys
import unittest

function_dir = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "function", "user_docs")
)
if function_dir not in sys.path:
    sys.path.insert(0, function_dir)

from rag_import_result import evaluate_rag_import_result
from utils import normalize_import_result_counts, serialize_import_result


class _ProtoStyleResponse:
    """Mimics ImportRagFilesResponse: attributes set, to_dict() empty."""

    imported_rag_files_count = 1
    failed_rag_files_count = 0
    skipped_rag_files_count = 0

    def to_dict(self):
        return {}


class TestSerializeImportResult(unittest.TestCase):
    def test_reads_counts_from_proto_attributes_when_to_dict_empty(self):
        serialized = serialize_import_result(_ProtoStyleResponse())
        self.assertEqual(
            serialized,
            {
                "imported_rag_files_count": 1,
                "failed_rag_files_count": 0,
                "skipped_rag_files_count": 0,
            },
        )

    def test_reads_camel_case_to_dict(self):
        serialized = serialize_import_result(
            {
                "importedRagFilesCount": 0,
                "failedRagFilesCount": 0,
                "skippedRagFilesCount": 2,
            }
        )
        self.assertEqual(serialized["skipped_rag_files_count"], 2)

    def test_normalize_reads_attributes_directly(self):
        counts = normalize_import_result_counts(_ProtoStyleResponse())
        self.assertEqual(counts["imported_rag_files_count"], 1)


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

    def test_success_imported_from_proto_style_response(self):
        ok, msg = evaluate_rag_import_result(
            {
                "document_import_result": serialize_import_result(_ProtoStyleResponse()),
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

    def test_success_skipped_camel_case_dict(self):
        ok, msg = evaluate_rag_import_result(
            {
                "document_import_result": {
                    "importedRagFilesCount": 0,
                    "failedRagFilesCount": 0,
                    "skippedRagFilesCount": 1,
                },
                "media_import_result": {},
            },
            1,
        )
        self.assertTrue(ok)
        self.assertIn("skipped=1", msg)

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
