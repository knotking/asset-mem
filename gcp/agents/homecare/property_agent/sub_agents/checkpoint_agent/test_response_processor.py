"""
Unit tests for checkpoint response processor
"""

import unittest
import json
from response_processor import (
    validate_checkpoint_response,
    extract_json_from_response,
    has_checkpoint_structure,
    generate_fallback_json,
    ensure_dual_format_response
)


class TestResponseProcessor(unittest.TestCase):
    
    def test_valid_dual_format_response(self):
        """Test that a valid dual-format response is recognized"""
        response = """# Kitchen Checkpoints

Based on your checkpoints, I found 2 relevant checkpoints.

```json
{
  "analysis": {
    "title": "Kitchen Checkpoints",
    "checkpointSummary": {
      "checkpointsAnalyzed": 2,
      "queryType": "single",
      "locations": ["Kitchen"],
      "dateRange": "Jan 2025"
    },
    "checkpointDetails": [
      {
        "name": "Kitchen Check",
        "location": "Kitchen",
        "date": "2025-01-15",
        "summary": "All items in good condition",
        "detectedItems": ["Refrigerator", "Stove"],
        "conditions": ["Good condition"],
        "issues": []
      }
    ]
  }
}
```
"""
        is_valid, processed, extracted = validate_checkpoint_response(response)
        self.assertTrue(is_valid)
        self.assertIsNotNone(extracted)
        self.assertIn("analysis", extracted)
        self.assertIn("checkpointSummary", extracted["analysis"])
    
    def test_markdown_only_response(self):
        """Test that markdown-only response is detected as invalid"""
        response = """# Kitchen Checkpoints

Based on your checkpoints, I found 2 relevant checkpoints from your kitchen.
"""
        is_valid, processed, extracted = validate_checkpoint_response(response)
        self.assertFalse(is_valid)
        self.assertIsNone(extracted)
    
    def test_json_without_checkpoint_structure(self):
        """Test that JSON without checkpoint fields is detected as invalid"""
        response = """# Kitchen Checkpoints

```json
{
  "analysis": {
    "title": "Kitchen Checkpoints"
  }
}
```
"""
        is_valid, processed, extracted = validate_checkpoint_response(response)
        self.assertFalse(is_valid)
        self.assertIsNotNone(extracted)  # JSON exists but invalid structure
    
    def test_extract_json_from_code_block(self):
        """Test JSON extraction from code block"""
        response = """Some text

```json
{
  "analysis": {
    "checkpointSummary": {
      "checkpointsAnalyzed": 1
    }
  }
}
```

More text"""
        extracted = extract_json_from_response(response)
        self.assertIsNotNone(extracted)
        self.assertIn("analysis", extracted)
    
    def test_has_checkpoint_structure_nested(self):
        """Test checkpoint structure detection in nested format"""
        data = {
            "analysis": {
                "checkpointSummary": {
                    "checkpointsAnalyzed": 2
                }
            }
        }
        self.assertTrue(has_checkpoint_structure(data))
    
    def test_has_checkpoint_structure_flat(self):
        """Test checkpoint structure detection in flat format"""
        data = {
            "checkpointSummary": {
                "checkpointsAnalyzed": 2
            }
        }
        self.assertTrue(has_checkpoint_structure(data))
    
    def test_has_checkpoint_structure_with_details(self):
        """Test checkpoint structure detection with checkpointDetails"""
        data = {
            "analysis": {
                "checkpointDetails": [
                    {"name": "Test", "location": "Kitchen"}
                ]
            }
        }
        self.assertTrue(has_checkpoint_structure(data))
    
    def test_generate_fallback_json(self):
        """Test fallback JSON generation"""
        checkpoints = [
            {
                "checkpointName": "Kitchen Check",
                "location": "Kitchen",
                "createdAt": "2025-01-15",
                "summary": "All good",
                "detectedItems": ["Refrigerator", "Stove"],
                "conditions": ["Good condition"],
                "issues": []
            }
        ]
        user_query = "Show me my kitchen checkpoints"
        
        fallback = generate_fallback_json(checkpoints, user_query)
        
        self.assertIn("analysis", fallback)
        self.assertIn("checkpointSummary", fallback["analysis"])
        self.assertIn("checkpointDetails", fallback["analysis"])
        self.assertEqual(fallback["analysis"]["checkpointSummary"]["checkpointsAnalyzed"], 1)
        self.assertEqual(len(fallback["analysis"]["checkpointDetails"]), 1)
    
    def test_ensure_dual_format_adds_json(self):
        """Test that ensure_dual_format_response adds JSON when missing"""
        response = "# Kitchen Checkpoints\n\nI found 1 checkpoint."
        checkpoints = [
            {
                "checkpointName": "Kitchen Check",
                "location": "Kitchen",
                "createdAt": "2025-01-15",
                "summary": "All good",
                "detectedItems": [],
                "conditions": [],
                "issues": []
            }
        ]
        user_query = "Show checkpoints"
        
        fixed_response = ensure_dual_format_response(response, checkpoints, user_query)
        
        self.assertIn("```json", fixed_response)
        self.assertIn("checkpointSummary", fixed_response)
        self.assertIn("checkpointDetails", fixed_response)
    
    def test_ensure_dual_format_preserves_valid_response(self):
        """Test that valid responses are not modified"""
        response = """# Kitchen Checkpoints

```json
{
  "analysis": {
    "checkpointSummary": {
      "checkpointsAnalyzed": 1,
      "locations": ["Kitchen"]
    },
    "checkpointDetails": []
  }
}
```
"""
        checkpoints = []
        user_query = "Show checkpoints"
        
        fixed_response = ensure_dual_format_response(response, checkpoints, user_query)
        
        # Should return original response unchanged
        self.assertEqual(response, fixed_response)
    
    def test_generate_fallback_with_issues(self):
        """Test fallback JSON generation with issues"""
        checkpoints = [
            {
                "checkpointName": "Kitchen Check",
                "location": "Kitchen",
                "createdAt": "2025-01-15",
                "summary": "Issues found",
                "detectedItems": ["Sink"],
                "conditions": ["Water damage"],
                "issues": [
                    {"description": "Leak under sink"},
                    {"description": "Loose cabinet door"}
                ]
            }
        ]
        user_query = "What issues were found?"
        
        fallback = generate_fallback_json(checkpoints, user_query)
        
        self.assertGreater(len(fallback["analysis"]["checkpointSummary"]["issuesDetected"]), 0)
        self.assertIn("Leak under sink", fallback["analysis"]["checkpointSummary"]["issuesDetected"])
    
    def test_generate_fallback_comparison_query(self):
        """Test fallback JSON for comparison queries"""
        checkpoints = [
            {"checkpointName": "Check 1", "location": "Kitchen", "createdAt": "2025-01-01", 
             "summary": "Good", "detectedItems": [], "conditions": [], "issues": []},
            {"checkpointName": "Check 2", "location": "Kitchen", "createdAt": "2025-01-15",
             "summary": "Issues", "detectedItems": [], "conditions": [], "issues": []}
        ]
        user_query = "What changed in my kitchen?"
        
        fallback = generate_fallback_json(checkpoints, user_query)
        
        self.assertEqual(fallback["analysis"]["checkpointSummary"]["queryType"], "comparison")
        self.assertIn("insights", fallback["analysis"])


if __name__ == '__main__':
    unittest.main()
