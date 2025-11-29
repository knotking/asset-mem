"""
Pydantic models for Gemini Robotics API.

Supports:
- Object detection and pointing
- Spatial reasoning
- Task orchestration
- Function calling
- Thinking configuration
"""

from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator


class Point(BaseModel):
    """2D point coordinates [y, x] normalized to 0-1000."""
    y: float = Field(..., ge=0.0, le=1000.0, description="Y coordinate (0-1000)")
    x: float = Field(..., ge=0.0, le=1000.0, description="X coordinate (0-1000)")
    
    def to_list(self) -> List[float]:
        """Convert to [y, x] list format."""
        return [self.y, self.x]
    
    @classmethod
    def from_list(cls, coords: List[float]) -> "Point":
        """Create from [y, x] list format."""
        if len(coords) != 2:
            raise ValueError("Point must have exactly 2 coordinates [y, x]")
        return cls(y=coords[0], x=coords[1])


class BoundingBox(BaseModel):
    """Bounding box coordinates."""
    x_min: float = Field(..., ge=0.0, le=1000.0, description="Minimum X coordinate")
    y_min: float = Field(..., ge=0.0, le=1000.0, description="Minimum Y coordinate")
    x_max: float = Field(..., ge=0.0, le=1000.0, description="Maximum X coordinate")
    y_max: float = Field(..., ge=0.0, le=1000.0, description="Maximum Y coordinate")
    
    @property
    def width(self) -> float:
        """Get bounding box width."""
        return self.x_max - self.x_min
    
    @property
    def height(self) -> float:
        """Get bounding box height."""
        return self.y_max - self.y_min
    
    @property
    def center(self) -> Point:
        """Get center point of bounding box."""
        return Point(
            y=(self.y_min + self.y_max) / 2,
            x=(self.x_min + self.x_max) / 2
        )


class DetectedObject(BaseModel):
    """Detected object with point and label."""
    point: Point = Field(..., description="Point coordinates [y, x]")
    label: str = Field(..., description="Object label/name")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence score if available")
    bounding_box: Optional[BoundingBox] = Field(None, description="Bounding box if available")


class ThinkingConfig(BaseModel):
    """Thinking configuration for Robotics model."""
    thinking_budget: float = Field(
        default=0.0,
        ge=0.0,
        description="Thinking budget (0.0 for low latency, higher for complex reasoning)"
    )


class FunctionDeclaration(BaseModel):
    """Function declaration for function calling."""
    name: str = Field(..., description="Function name")
    description: Optional[str] = Field(None, description="Function description")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Function parameters schema")


class Tool(BaseModel):
    """Tool configuration for function calling."""
    function_declarations: Optional[List[FunctionDeclaration]] = Field(
        None,
        description="List of function declarations"
    )


class GenerateContentConfig(BaseModel):
    """Configuration for generateContent with Robotics model."""
    model: str = Field(
        default="gemini-robotics-er-1.5-preview",
        description="Model to use (must be Robotics model)"
    )
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="Temperature")
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0, description="Top-p sampling")
    top_k: Optional[int] = Field(None, ge=1, description="Top-k sampling")
    max_output_tokens: Optional[int] = Field(None, ge=1, description="Max output tokens")
    thinking_config: Optional[ThinkingConfig] = Field(
        None,
        description="Thinking configuration for complex reasoning"
    )
    tools: Optional[List[Tool]] = Field(
        None,
        description="Tools for function calling"
    )
    response_mime_type: Optional[str] = Field(
        None,
        description="Response MIME type (e.g., 'application/json')"
    )
    response_schema: Optional[Dict[str, Any]] = Field(
        None,
        description="Response schema for structured output"
    )


class FunctionCall(BaseModel):
    """Function call from the model."""
    name: str = Field(..., description="Function name")
    args: Dict[str, Any] = Field(default_factory=dict, description="Function arguments")


class FunctionResponse(BaseModel):
    """Function response to send back to the model."""
    name: str = Field(..., description="Function name")
    response: Dict[str, Any] = Field(..., description="Function response data")


class Candidate(BaseModel):
    """Response candidate."""
    content: Optional[str] = Field(None, description="Generated content")
    finish_reason: Optional[str] = Field(None, description="Finish reason")
    function_calls: Optional[List[FunctionCall]] = Field(
        None,
        description="Function calls made by the model"
    )
    safety_ratings: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Safety ratings"
    )


class UsageMetadata(BaseModel):
    """Token usage metadata."""
    prompt_token_count: Optional[int] = Field(None, description="Prompt token count")
    candidates_token_count: Optional[int] = Field(None, description="Candidates token count")
    total_token_count: Optional[int] = Field(None, description="Total token count")


class GenerateContentResponse(BaseModel):
    """Response from generateContent with Robotics model."""
    text: str = Field(..., description="Generated text content")
    candidates: Optional[List[Candidate]] = Field(
        None,
        description="Response candidates"
    )
    model: Optional[str] = Field(None, description="Model used")
    finish_reason: Optional[str] = Field(None, description="Finish reason")
    usage_metadata: Optional[UsageMetadata] = Field(
        None,
        description="Token usage metadata"
    )
    
    @property
    def function_calls(self) -> List[FunctionCall]:
        """Get all function calls from candidates."""
        calls = []
        if self.candidates:
            for candidate in self.candidates:
                if candidate.function_calls:
                    calls.extend(candidate.function_calls)
        return calls
    
    @property
    def has_function_calls(self) -> bool:
        """Check if response contains function calls."""
        return len(self.function_calls) > 0
    
    @property
    def prompt_token_count(self) -> Optional[int]:
        """Get prompt token count from usage metadata."""
        if self.usage_metadata:
            return self.usage_metadata.prompt_token_count
        return None
    
    @property
    def candidates_token_count(self) -> Optional[int]:
        """Get candidates token count from usage metadata."""
        if self.usage_metadata:
            return self.usage_metadata.candidates_token_count
        return None
    
    @property
    def total_token_count(self) -> Optional[int]:
        """Get total token count from usage metadata."""
        if self.usage_metadata:
            return self.usage_metadata.total_token_count
        return None
    
    def parse_detected_objects(self) -> List[DetectedObject]:
        """
        Parse detected objects from JSON response text.
        
        Expects JSON format: [{"point": [y, x], "label": "..."}, ...]
        
        Returns:
            List[DetectedObject]: Parsed detected objects
        """
        import json
        
        try:
            # Try to parse the text as JSON
            data = json.loads(self.text)
            if not isinstance(data, list):
                return []
            
            objects = []
            for item in data:
                if isinstance(item, dict) and "point" in item and "label" in item:
                    point_data = item["point"]
                    if isinstance(point_data, list) and len(point_data) == 2:
                        point = Point.from_list(point_data)
                        obj = DetectedObject(
                            point=point,
                            label=item["label"],
                            confidence=item.get("confidence"),
                        )
                        if "bounding_box" in item:
                            bbox_data = item["bounding_box"]
                            obj.bounding_box = BoundingBox(**bbox_data)
                        objects.append(obj)
            return objects
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            # If parsing fails, return empty list
            return []


class ObjectDetectionRequest(BaseModel):
    """Request for object detection."""
    prompt: str = Field(
        ...,
        description="Prompt describing what objects to detect (e.g., 'Point to no more than 10 items in the image')"
    )
    max_objects: Optional[int] = Field(
        None,
        ge=1,
        description="Maximum number of objects to detect"
    )
    thinking_budget: float = Field(
        default=0.0,
        ge=0.0,
        description="Thinking budget (0.0 for low latency, higher for complex reasoning)"
    )


class TaskOrchestrationRequest(BaseModel):
    """Request for task orchestration."""
    task: str = Field(
        ...,
        description="Natural language task description (e.g., 'put the apple in the bowl')"
    )
    thinking_budget: float = Field(
        default=1.0,
        ge=0.0,
        description="Thinking budget for complex reasoning (higher for more complex tasks)"
    )
    tools: Optional[List[Tool]] = Field(
        None,
        description="Available tools/functions for the robot"
    )

