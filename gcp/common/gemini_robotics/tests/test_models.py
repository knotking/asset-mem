"""Tests for Gemini Robotics models."""

import pytest
from gemini_robotics.models import (
    Point,
    BoundingBox,
    DetectedObject,
    ThinkingConfig,
    GenerateContentConfig,
    Tool,
    FunctionDeclaration,
)


class TestPoint:
    """Tests for Point model."""
    
    def test_point_creation(self):
        """Test creating a Point."""
        point = Point(y=100.0, x=200.0)
        assert point.y == 100.0
        assert point.x == 200.0
    
    def test_point_to_list(self):
        """Test converting Point to list."""
        point = Point(y=100.0, x=200.0)
        assert point.to_list() == [100.0, 200.0]
    
    def test_point_from_list(self):
        """Test creating Point from list."""
        point = Point.from_list([100.0, 200.0])
        assert point.y == 100.0
        assert point.x == 200.0
    
    def test_point_validation(self):
        """Test Point validation."""
        # Valid point
        point = Point(y=500.0, x=500.0)
        assert point.y == 500.0
        
        # Invalid: out of range
        with pytest.raises(Exception):
            Point(y=1500.0, x=500.0)


class TestBoundingBox:
    """Tests for BoundingBox model."""
    
    def test_bounding_box_creation(self):
        """Test creating a BoundingBox."""
        bbox = BoundingBox(x_min=10.0, y_min=20.0, x_max=100.0, y_max=200.0)
        assert bbox.x_min == 10.0
        assert bbox.y_min == 20.0
        assert bbox.x_max == 100.0
        assert bbox.y_max == 200.0
    
    def test_bounding_box_properties(self):
        """Test BoundingBox properties."""
        bbox = BoundingBox(x_min=10.0, y_min=20.0, x_max=100.0, y_max=200.0)
        assert bbox.width == 90.0
        assert bbox.height == 180.0
        assert bbox.center.y == 110.0
        assert bbox.center.x == 55.0


class TestDetectedObject:
    """Tests for DetectedObject model."""
    
    def test_detected_object_creation(self):
        """Test creating a DetectedObject."""
        point = Point(y=100.0, x=200.0)
        obj = DetectedObject(point=point, label="apple")
        assert obj.point.y == 100.0
        assert obj.label == "apple"
        assert obj.confidence is None


class TestThinkingConfig:
    """Tests for ThinkingConfig model."""
    
    def test_thinking_config_default(self):
        """Test default ThinkingConfig."""
        config = ThinkingConfig()
        assert config.thinking_budget == 0.0
    
    def test_thinking_config_custom(self):
        """Test custom ThinkingConfig."""
        config = ThinkingConfig(thinking_budget=1.5)
        assert config.thinking_budget == 1.5


class TestGenerateContentConfig:
    """Tests for GenerateContentConfig model."""
    
    def test_default_config(self):
        """Test default GenerateContentConfig."""
        config = GenerateContentConfig()
        assert config.model == "gemini-robotics-er-1.5-preview"
        assert config.temperature is None
    
    def test_custom_config(self):
        """Test custom GenerateContentConfig."""
        thinking_config = ThinkingConfig(thinking_budget=1.0)
        config = GenerateContentConfig(
            temperature=0.7,
            max_output_tokens=2048,
            thinking_config=thinking_config
        )
        assert config.temperature == 0.7
        assert config.max_output_tokens == 2048
        assert config.thinking_config.thinking_budget == 1.0


class TestTool:
    """Tests for Tool model."""
    
    def test_tool_creation(self):
        """Test creating a Tool."""
        func_decl = FunctionDeclaration(
            name="move_arm",
            description="Move robot arm",
            parameters={"type": "object", "properties": {}}
        )
        tool = Tool(function_declarations=[func_decl])
        assert len(tool.function_declarations) == 1
        assert tool.function_declarations[0].name == "move_arm"

