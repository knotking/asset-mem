# Gemini Robotics - Robotics Support for Gemini API

A comprehensive Gemini API Robotics integration module for vision-language robotics applications using Gemini Robotics-ER 1.5.

## Features

- **Object Detection** - Identify and locate objects in images with normalized coordinates
- **Spatial Reasoning** - Understand object relationships and scene context
- **Task Orchestration** - Break down complex tasks into subtasks and plan actions
- **Function Calling** - Integrate with robot controllers and behaviors
- **Multimodal Input** - Support for text, images, video, and audio inputs
- **Thinking Budget** - Control latency vs accuracy tradeoffs
- **Async Support** - Full async/await support for high-performance applications
- **Vertex AI & API Key Auth** - Support for both Vertex AI and API key authentication

## Installation

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Or install individually:

```bash
pip install google-genai pydantic google-cloud-secret-manager
```

## Configuration

### Environment Variables (Vertex AI - Recommended)

Set the following environment variables for Vertex AI:

```bash
# Required
export GEMINI_PROJECT_ID="your-gcp-project-id"
export GEMINI_LOCATION="us-central1"

# Optional
export GEMINI_USE_VERTEX_AI="true"  # Default: true if project_id is set
export GEMINI_TIMEOUT="60"
export GEMINI_ROBOTICS_MODEL="gemini-robotics-er-1.5-preview"
```

### Environment Variables (API Key)

Alternatively, use API key authentication:

```bash
# Required
export GEMINI_API_KEY="your-api-key"

# Optional
export GEMINI_USE_VERTEX_AI="false"
export GEMINI_TIMEOUT="60"
export GEMINI_ROBOTICS_MODEL="gemini-robotics-er-1.5-preview"
```

### Using .env File

Create a `.env` file in your project root:

```env
GEMINI_PROJECT_ID=your-gcp-project-id
GEMINI_LOCATION=us-central1
GEMINI_USE_VERTEX_AI=true
```

Then load it in your code:

```python
from dotenv import load_dotenv
load_dotenv()

from gemini_robotics import GeminiRoboticsConfig, GeminiRoboticsClient

config = GeminiRoboticsConfig.from_env()
```

### Using Google Cloud Secret Manager

For production deployments, store configuration in GCP Secret Manager:

```bash
# Create secret with JSON config
echo '{"project_id": "...", "location": "...", "use_vertex_ai": true}' | \
  gcloud secrets create gemini-robotics-config --data-file=-
```

Then load in code:

```python
from gemini_robotics import GeminiRoboticsConfig, GeminiRoboticsClient

config = GeminiRoboticsConfig.from_gcp_secret_manager(
    project_id="your-secrets-project-id",
    config_secret="gemini-robotics-config",
)
```

## Usage

### Basic Setup

```python
import asyncio
from gemini_robotics import GeminiRoboticsClient, GeminiRoboticsConfig

# Load configuration
config = GeminiRoboticsConfig.from_env()

# Create client
client = GeminiRoboticsClient(config)
```

### Object Detection

Detect objects in an image and get their coordinates:

```python
async def detect_objects():
    async with GeminiRoboticsClient(GeminiRoboticsConfig.from_env()) as client:
        # Load image
        with open("scene.png", "rb") as f:
            image_bytes = f.read()
        
        # Detect objects
        response = await client.detect_objects(
            image_data=image_bytes,
            max_objects=10,
            thinking_budget=0.0  # Low latency for simple detection
        )
        
        # Parse detected objects
        objects = response.parse_detected_objects()
        
        for obj in objects:
            print(f"{obj.label} at {obj.point.to_list()}")
            if obj.bounding_box:
                print(f"  Bounding box: {obj.bounding_box.center.to_list()}")

asyncio.run(detect_objects())
```

### Custom Object Detection Prompt

```python
async def custom_detection():
    async with GeminiRoboticsClient(GeminiRoboticsConfig.from_env()) as client:
        with open("kitchen.png", "rb") as f:
            image_bytes = f.read()
        
        response = await client.detect_objects(
            image_data=image_bytes,
            prompt="Find all fruits in the image. Return their locations as [y, x] coordinates.",
            max_objects=5
        )
        
        objects = response.parse_detected_objects()
        print(f"Found {len(objects)} fruits")

asyncio.run(custom_detection())
```

### Task Orchestration

Break down complex tasks into subtasks:

```python
from gemini_robotics import Tool, FunctionDeclaration

async def orchestrate_task():
    async with GeminiRoboticsClient(GeminiRoboticsConfig.from_env()) as client:
        # Define robot functions
        tools = [
            Tool(function_declarations=[
                FunctionDeclaration(
                    name="move_arm",
                    description="Move robot arm to specified coordinates",
                    parameters={
                        "type": "object",
                        "properties": {
                            "x": {"type": "number", "description": "X coordinate"},
                            "y": {"type": "number", "description": "Y coordinate"},
                            "z": {"type": "number", "description": "Z coordinate"}
                        },
                        "required": ["x", "y", "z"]
                    }
                ),
                FunctionDeclaration(
                    name="grasp_object",
                    description="Grasp an object at the current arm position",
                    parameters={
                        "type": "object",
                        "properties": {
                            "force": {"type": "number", "description": "Grasp force"}
                        }
                    }
                ),
                FunctionDeclaration(
                    name="release_grasp",
                    description="Release the currently grasped object",
                    parameters={"type": "object", "properties": {}}
                )
            ])
        ]
        
        # Load scene image
        with open("scene.png", "rb") as f:
            image_bytes = f.read()
        
        # Orchestrate task
        response = await client.orchestrate_task(
            task="pick up the red cup and place it in the blue bowl",
            image_data=image_bytes,
            tools=tools,
            thinking_budget=2.0  # Higher budget for complex reasoning
        )
        
        print(response.text)
        
        # Execute function calls
        for func_call in response.function_calls:
            print(f"\nCalling {func_call.name} with args: {func_call.args}")
            # Execute the function call on your robot

asyncio.run(orchestrate_task())
```

### General Content Generation

Generate content with multimodal inputs:

```python
async def generate_content():
    async with GeminiRoboticsClient(GeminiRoboticsConfig.from_env()) as client:
        from google.genai import types
        
        # Load image
        with open("scene.png", "rb") as f:
            image_bytes = f.read()
        
        # Generate content
        response = await client.generate_content(
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
                "Describe the scene and identify all objects. What actions could a robot perform?"
            ],
            thinking_budget=0.5
        )
        
        print(response.text)

asyncio.run(generate_content())
```

### Video Input

Process video for temporal understanding:

```python
async def process_video():
    async with GeminiRoboticsClient(GeminiRoboticsConfig.from_env()) as client:
        from google.genai import types
        
        # Load video
        with open("robot_action.mp4", "rb") as f:
            video_bytes = f.read()
        
        response = await client.generate_content(
            contents=[
                types.Part.from_bytes(data=video_bytes, mime_type="video/mp4"),
                "Analyze the robot's actions. What task is it performing?"
            ],
            thinking_budget=1.0
        )
        
        print(response.text)

asyncio.run(process_video())
```

### Using Configuration Object

```python
from gemini_robotics import GenerateContentConfig, ThinkingConfig

async def with_config():
    async with GeminiRoboticsClient(GeminiRoboticsConfig.from_env()) as client:
        config = GenerateContentConfig(
            model="gemini-robotics-er-1.5-preview",
            temperature=0.7,
            max_output_tokens=2048,
            thinking_config=ThinkingConfig(thinking_budget=1.0)
        )
        
        response = await client.generate_content_with_config(
            contents="Plan a sequence of actions to clean up a table",
            config=config
        )
        print(response.text)

asyncio.run(with_config())
```

## API Reference

### GeminiRoboticsConfig

Configuration container for Gemini Robotics.

| Attribute | Type | Description |
|-----------|------|-------------|
| `project_id` | str | GCP project ID (required for Vertex AI) |
| `location` | str | GCP location (default: 'us-central1') |
| `api_key` | str | Gemini API key (required if not using Vertex AI) |
| `use_vertex_ai` | bool | Whether to use Vertex AI (default: True if project_id is set) |
| `timeout` | float | Request timeout in seconds (default: 60.0) |
| `model` | str | Model ID (default: 'gemini-robotics-er-1.5-preview') |

### GeminiRoboticsClient Methods

#### Core Methods

- `generate_content(contents, model?, temperature?, max_output_tokens?, thinking_budget?, tools?, response_mime_type?, response_schema?) -> GenerateContentResponse`
- `detect_objects(image_data, prompt?, max_objects?, thinking_budget?) -> GenerateContentResponse`
- `orchestrate_task(task, image_data?, video_data?, tools?, thinking_budget?) -> GenerateContentResponse`
- `generate_content_with_config(contents, config) -> GenerateContentResponse`

### Request Models

#### GenerateContentConfig

```python
GenerateContentConfig(
    model: str = "gemini-robotics-er-1.5-preview",  # Model to use
    temperature: float = None,                      # Temperature (0.0-2.0)
    top_p: float = None,                            # Top-p sampling (0.0-1.0)
    top_k: int = None,                              # Top-k sampling
    max_output_tokens: int = None,                  # Max output tokens
    thinking_config: ThinkingConfig = None,          # Thinking configuration
    tools: List[Tool] = None,                       # Tools for function calling
    response_mime_type: str = None,                  # Response MIME type
    response_schema: Dict = None,                   # Response schema for structured output
)
```

#### ThinkingConfig

```python
ThinkingConfig(
    thinking_budget: float = 0.0  # 0.0 for low latency, higher for complex reasoning
)
```

#### Point

```python
Point(
    y: float,  # Y coordinate (0-1000)
    x: float,  # X coordinate (0-1000)
)

point.to_list()  # Returns [y, x]
Point.from_list([y, x])  # Create from list
```

#### DetectedObject

```python
DetectedObject(
    point: Point,                    # Object location
    label: str,                      # Object label/name
    confidence: float = None,        # Confidence score (0.0-1.0)
    bounding_box: BoundingBox = None # Bounding box if available
)
```

### Response Models

#### GenerateContentResponse

```python
response.text                              # Generated text content
response.candidates                         # List[Candidate] - Response candidates
response.model                             # Model used
response.finish_reason                     # Finish reason
response.usage_metadata                     # Token usage metadata

# Convenience properties
response.function_calls                     # List[FunctionCall] - Function calls
response.has_function_calls                # bool - has function calls
response.prompt_token_count                # int - prompt tokens
response.candidates_token_count            # int - response tokens
response.total_token_count                 # int - total tokens

# Methods
response.parse_detected_objects()          # List[DetectedObject] - Parse detected objects from JSON
```

## Supported Models

The Robotics API uses:
- `gemini-robotics-er-1.5-preview` - Preview model for robotics applications

See the [official documentation](https://ai.google.dev/gemini-api/docs/robotics-overview) for details.

## Authentication

### Vertex AI (Recommended)

For Vertex AI authentication, use Application Default Credentials:

```bash
gcloud auth application-default login
```

Or set service account credentials:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

### API Key

For API key authentication, set the `GEMINI_API_KEY` environment variable:

```bash
export GEMINI_API_KEY="your-api-key"
export GEMINI_USE_VERTEX_AI="false"
```

### Required IAM Roles

For Vertex AI:
- `roles/aiplatform.user` - For using Vertex AI Gemini API

## Error Handling

```python
from gemini_robotics import GeminiRoboticsClient, GeminiRoboticsConfig
from gemini_robotics.client import GeminiRoboticsError

async def safe_query():
    try:
        async with GeminiRoboticsClient(GeminiRoboticsConfig.from_env()) as client:
            response = await client.detect_objects(
                image_data=image_bytes,
                max_objects=10
            )
            print(response.text)
    except GeminiRoboticsError as e:
        print(f"Gemini Robotics error: {e}")
        print(f"Status code: {e.status_code}")
        print(f"Details: {e.details}")
    except Exception as e:
        print(f"Unexpected error: {e}")

asyncio.run(safe_query())
```

## Pricing and Rate Limits

- **Pricing:** See the [Gemini API pricing page](https://ai.google.dev/pricing)
- **Rate Limits:** Typically aligns with underlying Gemini model rate limits
- **Thinking Budget:** Higher thinking budgets consume more tokens

For detailed pricing information, see the [Gemini API pricing page](https://ai.google.dev/pricing).

## Limitations

### Preview Status

- The model is currently in **Preview**. APIs and capabilities may change
- May not be suitable for production-critical applications without thorough testing

### Latency

- Complex queries, high-resolution inputs, or extensive `thinking_budget` can lead to increased processing times
- Use `thinking_budget=0.0` for low-latency object detection
- Increase thinking budget for complex reasoning tasks

### Hallucinations

- Like all large language models, Gemini Robotics-ER 1.5 can occasionally "hallucinate" or provide incorrect information
- Especially for ambiguous prompts or out-of-distribution inputs

### Input Types

- **Images:** Supported formats include PNG, JPEG, GIF, WebP
- **Video:** Supported formats include MP4, AVI, WebM
- **Audio:** Supported formats include MP3, WAV, OGG

See the [official documentation](https://ai.google.dev/gemini-api/docs/robotics-overview) for complete limitations.

## Best Practices

### 1. Use Appropriate Thinking Budget

```python
# Low latency for simple object detection
response = await client.detect_objects(
    image_data=image_bytes,
    thinking_budget=0.0
)

# Higher budget for complex reasoning
response = await client.orchestrate_task(
    task="complex multi-step task",
    thinking_budget=2.0
)
```

### 2. Provide Clear Prompts

```python
# Good: Specific and clear
prompt = "Point to all fruits in the image. Return coordinates as [y, x] normalized to 0-1000."

# Bad: Vague
prompt = "Find things"
```

### 3. Structure Function Declarations

```python
# Provide clear descriptions and parameter schemas
FunctionDeclaration(
    name="move_arm",
    description="Move robot arm to specified 3D coordinates",
    parameters={
        "type": "object",
        "properties": {
            "x": {"type": "number", "description": "X coordinate in meters"},
            "y": {"type": "number", "description": "Y coordinate in meters"},
            "z": {"type": "number", "description": "Z coordinate in meters"}
        },
        "required": ["x", "y", "z"]
    }
)
```

### 4. Handle Function Calls

```python
response = await client.orchestrate_task(
    task="pick up the cup",
    tools=tools
)

# Execute function calls sequentially
for func_call in response.function_calls:
    result = execute_robot_function(func_call.name, func_call.args)
    # Optionally send result back to model for next step
```

### 5. Optimize Image Input

```python
# For small objects, consider cropping/zooming
# The model works better with focused images
response = await client.detect_objects(
    image_data=cropped_image_bytes,  # Focused on area of interest
    max_objects=5
)
```

## Safety Notice

**Important:** While Gemini Robotics-ER 1.5 was built with safety in mind, it is your responsibility to maintain a safe environment around the robot. Generative AI models can make mistakes, and physical robots can cause damage. Safety is a priority, and making generative AI models safe when used with real-world robotics is an active and critical area of research.

**Privacy Notice:** The Robotics Models leverage video and audio data to operate and move hardware. If you operate the Robotics Models in a manner that collects Personal Data (voice, imagery, likeness), you must:
- Notify and obtain consent from identifiable persons
- Use commercially reasonable efforts to minimize Personal Data collection
- Follow the Gemini API Additional Terms of Service

See the [Google DeepMind robotics safety page](https://deepmind.google/discover/blog/robotics-safety/) for more information.

## Examples

### Example 1: Object Detection

```python
async def detect_fruits():
    async with GeminiRoboticsClient(GeminiRoboticsConfig.from_env()) as client:
        with open("kitchen.png", "rb") as f:
            image_bytes = f.read()
        
        response = await client.detect_objects(
            image_data=image_bytes,
            prompt="Find all fruits in the image",
            max_objects=10
        )
        
        objects = response.parse_detected_objects()
        print(f"Found {len(objects)} fruits:")
        for obj in objects:
            print(f"  - {obj.label} at {obj.point.to_list()}")

asyncio.run(detect_fruits())
```

### Example 2: Task Planning

```python
async def plan_cleanup():
    async with GeminiRoboticsClient(GeminiRoboticsConfig.from_env()) as client:
        with open("messy_table.png", "rb") as f:
            image_bytes = f.read()
        
        response = await client.orchestrate_task(
            task="Organize the items on the table by putting similar items together",
            image_data=image_bytes,
            thinking_budget=1.5
        )
        
        print("Task Plan:")
        print(response.text)
        
        if response.has_function_calls:
            print(f"\n{len(response.function_calls)} function calls generated")

asyncio.run(plan_cleanup())
```

### Example 3: Spatial Reasoning

```python
async def spatial_reasoning():
    async with GeminiRoboticsClient(GeminiRoboticsConfig.from_env()) as client:
        from google.genai import types
        
        with open("scene.png", "rb") as f:
            image_bytes = f.read()
        
        response = await client.generate_content(
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
                "Analyze the spatial relationships between objects. Which objects are closest to each other? What is the best path to move object A to location B?"
            ],
            thinking_budget=1.0
        )
        
        print(response.text)

asyncio.run(spatial_reasoning())
```

## References

- [Gemini API Robotics Documentation](https://ai.google.dev/gemini-api/docs/robotics-overview)
- [Gemini API Pricing](https://ai.google.dev/pricing)
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/quota)
- [Google DeepMind Robotics Safety](https://deepmind.google/discover/blog/robotics-safety/)
- [Robotics Cookbook](https://ai.google.dev/gemini-api/docs/robotics-overview#robotics-cookbook)

## License

Internal use only.

