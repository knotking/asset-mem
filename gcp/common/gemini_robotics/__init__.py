"""
Gemini Robotics - Robotics Support for Gemini API

Provides support for Gemini Robotics-ER 1.5 model for:
- Object detection and pointing in images/videos
- Spatial reasoning and scene understanding
- Task orchestration and planning
- Function calling for robot control
"""

from .client import GeminiRoboticsClient, GeminiRoboticsError
from .models import (
    GenerateContentConfig,
    GenerateContentResponse,
    ThinkingConfig,
    Point,
    BoundingBox,
    DetectedObject,
    ObjectDetectionRequest,
    TaskOrchestrationRequest,
    Tool,
    FunctionDeclaration,
    FunctionCall,
    FunctionResponse,
    Candidate,
    UsageMetadata,
)
from .config import GeminiRoboticsConfig

__all__ = [
    # Client
    "GeminiRoboticsClient",
    "GeminiRoboticsError",
    # Config
    "GeminiRoboticsConfig",
    # Models
    "GenerateContentConfig",
    "GenerateContentResponse",
    "ThinkingConfig",
    "Point",
    "BoundingBox",
    "DetectedObject",
    "ObjectDetectionRequest",
    "TaskOrchestrationRequest",
    "Tool",
    "FunctionDeclaration",
    "FunctionCall",
    "FunctionResponse",
    "Candidate",
    "UsageMetadata",
]

