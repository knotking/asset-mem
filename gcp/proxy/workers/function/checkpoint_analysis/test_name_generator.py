"""
Unit tests for checkpoint name generation.
"""

import pytest
from name_generator import (
    generate_checkpoint_name,
    _extract_and_sort_issues,
    _generate_name_with_issues,
    _generate_name_without_issues,
    _shorten_issue_description,
    _truncate_name,
    _get_positive_adjective_from_conditions,
)


class TestGenerateCheckpointName:
    """Test the main generate_checkpoint_name function."""
    
    def test_critical_issue(self):
        """Test naming with critical issue."""
        analysis_result = {
            "issues": [
                {"description": "Gas leak detected near stove", "severity": "critical"}
            ],
            "condition_scores": {"overall": 50},
            "conditions": ["damaged"]
        }
        name = generate_checkpoint_name(analysis_result, "Kitchen", None)
        assert "gas leak" in name.lower()
        assert "kitchen" in name.lower()
    
    def test_major_issue(self):
        """Test naming with major issue."""
        analysis_result = {
            "issues": [
                {"description": "Large crack in foundation wall", "severity": "major"}
            ],
            "condition_scores": {"overall": 60},
            "conditions": ["damaged"]
        }
        name = generate_checkpoint_name(analysis_result, "Basement", None)
        assert "crack" in name.lower()
        assert "basement" in name.lower()
    
    def test_moderate_issue(self):
        """Test naming with moderate issue."""
        analysis_result = {
            "issues": [
                {"description": "Water staining on ceiling", "severity": "moderate"}
            ],
            "condition_scores": {"overall": 70},
            "conditions": ["fair"]
        }
        name = generate_checkpoint_name(analysis_result, "Bathroom", None)
        assert "bathroom" in name.lower()
        assert "water" in name.lower()
    
    def test_minor_issue(self):
        """Test naming with minor issue."""
        analysis_result = {
            "issues": [
                {"description": "Worn carpet fibers", "severity": "minor"}
            ],
            "condition_scores": {"overall": 75},
            "conditions": ["good"]
        }
        name = generate_checkpoint_name(analysis_result, "Living Room", None)
        assert "living room" in name.lower()
        assert "-" in name  # Minor issues use dash format
    
    def test_excellent_condition_no_issues(self):
        """Test naming with excellent condition and no issues."""
        analysis_result = {
            "issues": [],
            "condition_scores": {"overall": 95},
            "conditions": ["excellent", "clean"]
        }
        name = generate_checkpoint_name(analysis_result, "Kitchen", None)
        assert "excellent" in name.lower()
        assert "kitchen" in name.lower()
    
    def test_good_condition_no_issues(self):
        """Test naming with good condition and no issues."""
        analysis_result = {
            "issues": [],
            "condition_scores": {"overall": 80},
            "conditions": ["good", "well-maintained"]
        }
        name = generate_checkpoint_name(analysis_result, "Bathroom", None)
        assert "well-maintained" in name.lower() or "good" in name.lower()
        assert "bathroom" in name.lower()
    
    def test_multiple_issues_picks_highest_severity(self):
        """Test that highest severity issue is chosen when multiple exist."""
        analysis_result = {
            "issues": [
                {"description": "Minor scratch on wall", "severity": "minor"},
                {"description": "Structural crack visible", "severity": "major"},
                {"description": "Paint peeling slightly", "severity": "minor"}
            ],
            "condition_scores": {"overall": 65},
            "conditions": ["damaged"]
        }
        name = generate_checkpoint_name(analysis_result, "Living Room", None)
        assert "crack" in name.lower()  # Major issue should be prioritized
        assert "scratch" not in name.lower()  # Minor issues ignored
    
    def test_no_location_uses_detected_asset(self):
        """Test that detected asset is used when location is missing."""
        analysis_result = {
            "issues": [],
            "condition_scores": {"overall": 85},
            "conditions": ["good"]
        }
        name = generate_checkpoint_name(analysis_result, None, "Garage")
        assert "garage" in name.lower()
    
    def test_no_location_or_asset_uses_property(self):
        """Test fallback to 'Property' when no location info."""
        analysis_result = {
            "issues": [],
            "condition_scores": {"overall": 75},
            "conditions": ["good"]
        }
        name = generate_checkpoint_name(analysis_result, None, None)
        assert "property" in name.lower()
    
    def test_vehicle_checkpoint(self):
        """Test naming for vehicle checkpoint."""
        analysis_result = {
            "issues": [
                {"description": "Dented rear bumper", "severity": "major"}
            ],
            "condition_scores": {"overall": 70}
        }
        name = generate_checkpoint_name(analysis_result, "Vehicle", None)
        assert "dent" in name.lower()
    
    def test_appliance_checkpoint(self):
        """Test naming for appliance checkpoint."""
        analysis_result = {
            "issues": [
                {"description": "Door seal worn", "severity": "moderate"}
            ],
            "condition_scores": {"overall": 65}
        }
        name = generate_checkpoint_name(analysis_result, "Refrigerator", None)
        assert "refrigerator" in name.lower()
        assert "seal" in name.lower() or "door" in name.lower()
    
    def test_legacy_string_issues(self):
        """Test handling of legacy string-format issues."""
        analysis_result = {
            "issues": ["Some damage detected", "Minor wear visible"],
            "condition_scores": {"overall": 70}
        }
        name = generate_checkpoint_name(analysis_result, "Kitchen", None)
        assert "kitchen" in name.lower()
        # Should handle string issues gracefully
    
    def test_empty_analysis_result(self):
        """Test handling of empty analysis result."""
        analysis_result = {}
        name = generate_checkpoint_name(analysis_result, "Kitchen", None)
        assert "kitchen" in name.lower()
        assert "checkpoint" in name.lower()
    
    def test_name_length_limit(self):
        """Test that names are truncated to reasonable length."""
        analysis_result = {
            "issues": [
                {
                    "description": "Very long issue description that goes on and on with excessive detail",
                    "severity": "major"
                }
            ],
            "condition_scores": {"overall": 60}
        }
        name = generate_checkpoint_name(analysis_result, "Kitchen", None)
        assert len(name) <= 50  # Should be truncated


class TestExtractAndSortIssues:
    """Test issue extraction and sorting."""
    
    def test_sort_by_severity(self):
        """Test that issues are sorted by severity."""
        issues = [
            {"description": "Minor issue", "severity": "minor"},
            {"description": "Critical issue", "severity": "critical"},
            {"description": "Moderate issue", "severity": "moderate"},
            {"description": "Major issue", "severity": "major"}
        ]
        sorted_issues = _extract_and_sort_issues(issues)
        
        assert sorted_issues[0]["severity"] == "critical"
        assert sorted_issues[1]["severity"] == "major"
        assert sorted_issues[2]["severity"] == "moderate"
        assert sorted_issues[3]["severity"] == "minor"
    
    def test_handles_string_issues(self):
        """Test handling of legacy string format."""
        issues = ["String issue 1", "String issue 2"]
        sorted_issues = _extract_and_sort_issues(issues)
        
        assert len(sorted_issues) == 2
        assert sorted_issues[0]["severity"] == "minor"
        assert sorted_issues[0]["description"] == "String issue 1"
    
    def test_filters_empty_descriptions(self):
        """Test that issues with empty descriptions are filtered out."""
        issues = [
            {"description": "", "severity": "major"},
            {"description": "Real issue", "severity": "minor"}
        ]
        sorted_issues = _extract_and_sort_issues(issues)
        
        assert len(sorted_issues) == 1
        assert sorted_issues[0]["description"] == "Real issue"
    
    def test_empty_issues_list(self):
        """Test handling of empty issues list."""
        sorted_issues = _extract_and_sort_issues([])
        assert sorted_issues == []


class TestGenerateNameWithIssues:
    """Test name generation when issues are present."""
    
    def test_critical_issue_format(self):
        """Test format for critical issues."""
        issues = [{"description": "Gas leak", "severity": "critical"}]
        name = _generate_name_with_issues(issues, "Kitchen")
        assert "gas leak" in name.lower()
        assert "in kitchen" in name.lower()
    
    def test_major_issue_format(self):
        """Test format for major issues."""
        issues = [{"description": "Foundation crack", "severity": "major"}]
        name = _generate_name_with_issues(issues, "Basement")
        assert "foundation crack" in name.lower()
        assert "in basement" in name.lower()
    
    def test_moderate_issue_format(self):
        """Test format for moderate issues."""
        issues = [{"description": "Water staining", "severity": "moderate"}]
        name = _generate_name_with_issues(issues, "Bathroom")
        assert "bathroom with" in name.lower()
        assert "water staining" in name.lower()
    
    def test_minor_issue_format(self):
        """Test format for minor issues."""
        issues = [{"description": "Scratched paint", "severity": "minor"}]
        name = _generate_name_with_issues(issues, "Living Room")
        assert "living room -" in name.lower()
        assert "scratch" in name.lower()


class TestGenerateNameWithoutIssues:
    """Test name generation when no issues are present."""
    
    def test_excellent_score(self):
        """Test excellent condition name."""
        condition_scores = {"overall": 95}
        conditions = ["excellent"]
        name = _generate_name_without_issues(condition_scores, conditions, "Kitchen")
        assert "excellent" in name.lower()
        assert "kitchen" in name.lower()
    
    def test_well_maintained_score(self):
        """Test well-maintained condition name."""
        condition_scores = {"overall": 80}
        conditions = ["good"]
        name = _generate_name_without_issues(condition_scores, conditions, "Garage")
        assert "well-maintained" in name.lower()
        assert "garage" in name.lower()
    
    def test_good_condition_score(self):
        """Test good condition name."""
        condition_scores = {"overall": 65}
        conditions = ["good"]
        name = _generate_name_without_issues(condition_scores, conditions, "Bathroom")
        assert "good" in name.lower()
        assert "bathroom" in name.lower()
    
    def test_low_score_no_positive_conditions(self):
        """Test fallback when score is low and no positive conditions."""
        condition_scores = {"overall": 50}
        conditions = ["worn"]
        name = _generate_name_without_issues(condition_scores, conditions, "Attic")
        assert "attic" in name.lower()
        assert "checkpoint" in name.lower()
    
    def test_positive_condition_keywords(self):
        """Test detection of positive condition keywords."""
        condition_scores = {"overall": 70}
        conditions = ["clean", "organized"]
        name = _generate_name_without_issues(condition_scores, conditions, "Closet")
        assert "clean" in name.lower()
        assert "closet" in name.lower()


class TestShortenIssueDescription:
    """Test issue description shortening."""
    
    def test_removes_detected_prefix(self):
        """Test removal of 'detected' prefix."""
        desc = "detected water damage"
        shortened = _shorten_issue_description(desc)
        assert shortened.lower().startswith("water")
    
    def test_removes_visible_prefix(self):
        """Test removal of 'visible' prefix."""
        desc = "visible cracks in wall"
        shortened = _shorten_issue_description(desc)
        assert shortened.lower().startswith("cracks")
    
    def test_capitalizes_first_letter(self):
        """Test that first letter is capitalized."""
        desc = "water damage"
        shortened = _shorten_issue_description(desc)
        assert shortened[0].isupper()
    
    def test_truncates_long_descriptions(self):
        """Test that very long descriptions are truncated."""
        desc = "This is an extremely long issue description that needs to be shortened"
        shortened = _shorten_issue_description(desc, max_length=20)
        assert len(shortened) <= 20
        assert shortened.endswith("...")


class TestTruncateName:
    """Test name truncation."""
    
    def test_no_truncation_when_short(self):
        """Test that short names are not truncated."""
        name = "Kitchen checkpoint"
        truncated = _truncate_name(name, max_length=50)
        assert truncated == name
    
    def test_truncates_at_word_boundary(self):
        """Test that truncation tries to preserve word boundaries."""
        name = "Very long checkpoint name that needs to be truncated properly"
        truncated = _truncate_name(name, max_length=40)
        assert len(truncated) <= 40
        assert truncated.endswith("...")
        # Should not end with partial word (if possible)
    
    def test_truncates_when_no_good_boundary(self):
        """Test truncation when no good word boundary exists."""
        name = "VeryLongSingleWordWithNoSpaces"
        truncated = _truncate_name(name, max_length=20)
        assert len(truncated) <= 20
        assert truncated.endswith("...")


class TestGetPositiveAdjectiveFromConditions:
    """Test extraction of positive adjectives from conditions."""
    
    def test_finds_excellent(self):
        """Test finding 'excellent' condition."""
        conditions = ["excellent", "clean"]
        adjective = _get_positive_adjective_from_conditions(conditions)
        assert adjective == "Excellent"
    
    def test_finds_good(self):
        """Test finding 'good' condition."""
        conditions = ["good", "tidy"]
        adjective = _get_positive_adjective_from_conditions(conditions)
        assert adjective == "Good"
    
    def test_finds_well_maintained(self):
        """Test finding 'well-maintained' condition."""
        conditions = ["well-maintained", "functional"]
        adjective = _get_positive_adjective_from_conditions(conditions)
        assert adjective == "Well-maintained"
    
    def test_returns_none_for_no_positive_conditions(self):
        """Test that None is returned when no positive conditions exist."""
        conditions = ["damaged", "worn"]
        adjective = _get_positive_adjective_from_conditions(conditions)
        assert adjective is None
    
    def test_handles_empty_conditions(self):
        """Test handling of empty conditions list."""
        adjective = _get_positive_adjective_from_conditions([])
        assert adjective is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
