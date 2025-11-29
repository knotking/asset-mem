"""
Gemini Robotics Client for robotics operations.

Provides async methods for:
- Object detection and pointing in images/videos
- Spatial reasoning and scene understanding
- Task orchestration and planning
- Function calling for robot control
"""

import asyncio
import logging
from typing import Optional, Dict, Any, Union, List
from pathlib import Path

from .config import GeminiRoboticsConfig
from .models import (
    GenerateContentConfig,
    GenerateContentResponse,
    ThinkingConfig,
    Point,
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

logger = logging.getLogger(__name__)


class GeminiRoboticsError(Exception):
    """Base exception for Gemini Robotics client errors."""
    def __init__(
        self, 
        message: str, 
        status_code: Optional[int] = None, 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class GeminiRoboticsClient:
    """
    Client for Gemini Robotics API operations.
    
    Supports generating content with Robotics model for:
    - Object detection and pointing
    - Spatial reasoning
    - Task orchestration
    - Function calling
    
    Example:
        config = GeminiRoboticsConfig.from_env()
        client = GeminiRoboticsClient(config)
        
        # Detect objects in an image
        with open("image.png", "rb") as f:
            image_bytes = f.read()
        
        response = await client.detect_objects(
            image_bytes=image_bytes,
            prompt="Point to no more than 10 items in the image"
        )
        
        objects = response.parse_detected_objects()
        for obj in objects:
            print(f"{obj.label} at {obj.point.to_list()}")
    """
    
    def __init__(self, config: GeminiRoboticsConfig):
        """
        Initialize Gemini Robotics client.
        
        Args:
            config: GeminiRoboticsConfig instance
        """
        self.config = config
        self._client = None
    
    def _get_client(self):
        """Get or create the Gemini client."""
        if self._client is None:
            from google import genai
            
            if self.config.use_vertex_ai:
                if not self.config.project_id:
                    raise ValueError("Project ID required for Vertex AI")
                self._client = genai.Client(
                    vertexai=True,
                    project=self.config.project_id,
                    location=self.config.location
                )
            else:
                if not self.config.api_key:
                    raise ValueError("API key required when not using Vertex AI")
                self._client = genai.Client(api_key=self.config.api_key)
        
        return self._client
    
    async def close(self):
        """Close the client connection."""
        # The genai.Client doesn't require explicit closing
        # but we reset the reference
        self._client = None
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    def _prepare_image_part(self, image_data: Union[bytes, str, Path]) -> Any:
        """
        Prepare image data for API call.
        
        Args:
            image_data: Image bytes, file path, or Path object
            
        Returns:
            Part object for API call
        """
        from google.genai import types
        
        if isinstance(image_data, Path):
            image_data = str(image_data)
        
        if isinstance(image_data, str):
            # Assume it's a file path
            with open(image_data, 'rb') as f:
                image_bytes = f.read()
        else:
            image_bytes = image_data
        
        # Try to detect MIME type from first bytes
        mime_type = "image/png"  # Default
        if image_bytes.startswith(b'\xff\xd8\xff'):
            mime_type = "image/jpeg"
        elif image_bytes.startswith(b'\x89PNG'):
            mime_type = "image/png"
        elif image_bytes.startswith(b'GIF'):
            mime_type = "image/gif"
        elif image_bytes.startswith(b'RIFF') and b'WEBP' in image_bytes[:12]:
            mime_type = "image/webp"
        
        return types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
    
    def _prepare_video_part(self, video_data: Union[bytes, str, Path]) -> Any:
        """
        Prepare video data for API call.
        
        Args:
            video_data: Video bytes, file path, or Path object
            
        Returns:
            Part object for API call
        """
        from google.genai import types
        
        if isinstance(video_data, Path):
            video_data = str(video_data)
        
        if isinstance(video_data, str):
            # Assume it's a file path
            with open(video_data, 'rb') as f:
                video_bytes = f.read()
        else:
            video_bytes = video_data
        
        # Try to detect MIME type
        mime_type = "video/mp4"  # Default
        if video_bytes.startswith(b'\x00\x00\x00\x18ftypmp4'):
            mime_type = "video/mp4"
        elif video_bytes.startswith(b'RIFF') and b'AVI ' in video_bytes[:12]:
            mime_type = "video/avi"
        elif video_bytes.startswith(b'\x1a\x45\xdf\xa3'):
            mime_type = "video/webm"
        
        return types.Part.from_bytes(data=video_bytes, mime_type=mime_type)
    
    def _prepare_audio_part(self, audio_data: Union[bytes, str, Path]) -> Any:
        """
        Prepare audio data for API call.
        
        Args:
            audio_data: Audio bytes, file path, or Path object
            
        Returns:
            Part object for API call
        """
        from google.genai import types
        
        if isinstance(audio_data, Path):
            audio_data = str(audio_data)
        
        if isinstance(audio_data, str):
            # Assume it's a file path
            with open(audio_data, 'rb') as f:
                audio_bytes = f.read()
        else:
            audio_bytes = audio_data
        
        # Try to detect MIME type
        mime_type = "audio/mpeg"  # Default
        if audio_bytes.startswith(b'ID3') or audio_bytes.startswith(b'\xff\xfb'):
            mime_type = "audio/mpeg"
        elif audio_bytes.startswith(b'RIFF') and b'WAVE' in audio_bytes[:12]:
            mime_type = "audio/wav"
        elif audio_bytes.startswith(b'OggS'):
            mime_type = "audio/ogg"
        
        return types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
    
    async def generate_content(
        self,
        contents: Union[str, List[Any]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_output_tokens: Optional[int] = None,
        thinking_budget: float = 0.0,
        tools: Optional[List[Tool]] = None,
        response_mime_type: Optional[str] = None,
        response_schema: Optional[Dict[str, Any]] = None,
    ) -> GenerateContentResponse:
        """
        Generate content using Robotics model.
        
        Args:
            contents: Text prompt or list of parts (text, images, video, audio)
            model: Model to use (default: from config)
            temperature: Temperature for generation
            max_output_tokens: Maximum output tokens
            thinking_budget: Thinking budget (0.0 for low latency, higher for complex reasoning)
            tools: Tools for function calling
            response_mime_type: Response MIME type (e.g., 'application/json')
            response_schema: Response schema for structured output
            
        Returns:
            GenerateContentResponse: Generated content response
            
        Example:
            # Text only
            response = await client.generate_content(
                contents="Describe the scene",
                thinking_budget=0.5
            )
            
            # With image
            with open("image.png", "rb") as f:
                image_bytes = f.read()
            response = await client.generate_content(
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
                    "What objects do you see?"
                ]
            )
        """
        client = self._get_client()
        model = model or self.config.model
        
        try:
            from google.genai import types
            
            # Build config dict
            config_dict = {}
            
            if thinking_budget > 0.0:
                config_dict["thinking_config"] = types.ThinkingConfig(
                    thinking_budget=thinking_budget
                )
            
            if temperature is not None:
                config_dict["temperature"] = temperature
            if max_output_tokens is not None:
                config_dict["max_output_tokens"] = max_output_tokens
            if response_mime_type:
                config_dict["response_mime_type"] = response_mime_type
            if response_schema:
                config_dict["response_schema"] = response_schema
            
            # Build tools if provided
            if tools:
                tools_list = []
                for tool in tools:
                    tool_dict = {}
                    if tool.function_declarations:
                        func_decls = []
                        for func_decl in tool.function_declarations:
                            func_dict = {"name": func_decl.name}
                            if func_decl.description:
                                func_dict["description"] = func_decl.description
                            if func_decl.parameters:
                                func_dict["parameters"] = func_decl.parameters
                            func_decls.append(func_dict)
                        tool_dict["function_declarations"] = func_decls
                    tools_list.append(tool_dict)
                config_dict["tools"] = tools_list
            
            config = types.GenerateContentConfig(**config_dict) if config_dict else None
            
            # Prepare contents
            if isinstance(contents, str):
                contents_list = [contents]
            else:
                contents_list = contents
            
            # Make the API call
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.models.generate_content(
                    model=model,
                    contents=contents_list,
                    config=config
                )
            )
            
            # Parse response
            text = response.text if hasattr(response, "text") else ""
            
            # Parse candidates
            candidates = None
            if hasattr(response, "candidates") and response.candidates:
                candidates_list = []
                for candidate in response.candidates:
                    function_calls = None
                    if hasattr(candidate, "function_calls"):
                        calls = []
                        for fc in candidate.function_calls:
                            calls.append(FunctionCall(
                                name=getattr(fc, "name", ""),
                                args=getattr(fc, "args", {})
                            ))
                        function_calls = calls if calls else None
                    
                    candidates_list.append(Candidate(
                        content=getattr(candidate, "content", None),
                        finish_reason=getattr(candidate, "finish_reason", None),
                        function_calls=function_calls,
                        safety_ratings=getattr(candidate, "safety_ratings", None),
                    ))
                candidates = candidates_list if candidates_list else None
            
            # Parse usage metadata
            usage_metadata = None
            if hasattr(response, "usage_metadata"):
                um = response.usage_metadata
                usage_metadata = UsageMetadata(
                    prompt_token_count=getattr(um, "prompt_token_count", None),
                    candidates_token_count=getattr(um, "candidates_token_count", None),
                    total_token_count=getattr(um, "total_token_count", None),
                )
            
            return GenerateContentResponse(
                text=text,
                candidates=candidates,
                model=model,
                finish_reason=getattr(response, "finish_reason", None),
                usage_metadata=usage_metadata,
            )
            
        except Exception as e:
            logger.error(f"Failed to generate content: {e}")
            raise GeminiRoboticsError(
                message=f"Failed to generate content: {e}",
                details={
                    "model": model,
                    "thinking_budget": thinking_budget,
                    "has_tools": tools is not None,
                }
            )
    
    async def detect_objects(
        self,
        image_data: Union[bytes, str, Path],
        prompt: Optional[str] = None,
        max_objects: Optional[int] = None,
        thinking_budget: float = 0.0,
    ) -> GenerateContentResponse:
        """
        Detect objects in an image and return their coordinates.
        
        Args:
            image_data: Image bytes, file path, or Path object
            prompt: Custom prompt (default: standard object detection prompt)
            max_objects: Maximum number of objects to detect
            thinking_budget: Thinking budget (0.0 for low latency)
            
        Returns:
            GenerateContentResponse: Response with detected objects (can be parsed with parse_detected_objects())
            
        Example:
            with open("scene.png", "rb") as f:
                image_bytes = f.read()
            
            response = await client.detect_objects(
                image_bytes=image_bytes,
                max_objects=10
            )
            
            objects = response.parse_detected_objects()
            for obj in objects:
                print(f"{obj.label} at {obj.point.to_list()}")
        """
        if prompt is None:
            max_str = f"no more than {max_objects}" if max_objects else "no more than 10"
            prompt = f"""Point to {max_str} items in the image. The label returned
should be an identifying name for the object detected.
The answer should follow the json format: [{{"point": [y, x], "label": <label1>}}, ...].
The points are in [y, x] format normalized to 0-1000."""
        
        image_part = self._prepare_image_part(image_data)
        
        return await self.generate_content(
            contents=[image_part, prompt],
            thinking_budget=thinking_budget,
            response_mime_type="application/json",
        )
    
    async def orchestrate_task(
        self,
        task: str,
        image_data: Optional[Union[bytes, str, Path]] = None,
        video_data: Optional[Union[bytes, str, Path]] = None,
        tools: Optional[List[Tool]] = None,
        thinking_budget: float = 1.0,
    ) -> GenerateContentResponse:
        """
        Orchestrate a complex task by breaking it down into subtasks.
        
        Args:
            task: Natural language task description (e.g., "put the apple in the bowl")
            image_data: Optional image to understand the scene
            video_data: Optional video to understand the scene
            tools: Available tools/functions for the robot
            thinking_budget: Thinking budget (higher for complex tasks)
            
        Returns:
            GenerateContentResponse: Response with task plan and function calls
            
        Example:
            # Define robot functions
            tools = [
                Tool(function_declarations=[
                    FunctionDeclaration(
                        name="move_arm",
                        description="Move robot arm to coordinates",
                        parameters={
                            "type": "object",
                            "properties": {
                                "x": {"type": "number"},
                                "y": {"type": "number"},
                                "z": {"type": "number"}
                            }
                        }
                    )
                ])
            ]
            
            response = await client.orchestrate_task(
                task="pick up the red cup",
                image_data="scene.png",
                tools=tools,
                thinking_budget=2.0
            )
            
            # Execute function calls
            for func_call in response.function_calls:
                print(f"Calling {func_call.name} with {func_call.args}")
        """
        contents = [task]
        
        if image_data:
            contents.insert(0, self._prepare_image_part(image_data))
        elif video_data:
            contents.insert(0, self._prepare_video_part(video_data))
        
        return await self.generate_content(
            contents=contents,
            thinking_budget=thinking_budget,
            tools=tools,
        )
    
    async def generate_content_with_config(
        self,
        contents: Union[str, List[Any]],
        config: GenerateContentConfig,
    ) -> GenerateContentResponse:
        """
        Generate content using a GenerateContentConfig object.
        
        Args:
            contents: Text prompt or list of parts
            config: GenerateContentConfig instance
            
        Returns:
            GenerateContentResponse: Generated content response
        """
        thinking_budget = 0.0
        if config.thinking_config:
            thinking_budget = config.thinking_config.thinking_budget
        
        return await self.generate_content(
            contents=contents,
            model=config.model,
            temperature=config.temperature,
            max_output_tokens=config.max_output_tokens,
            thinking_budget=thinking_budget,
            tools=config.tools,
            response_mime_type=config.response_mime_type,
            response_schema=config.response_schema,
        )

