import os
import uuid
import base64
import json
import tempfile
import asyncio
import mimetypes
from typing import Optional, Dict, Any

from google.cloud.storage.client import Client
from google.adk.agents import Agent 
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import ToolContext
from vertexai.preview import rag  
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont

from gcp.common.gemini_robotics import GeminiRoboticsClient, GeminiRoboticsConfig
from .prompts import (
    triage_agent_instructions, 
    analysis_agent_instructions,
    multimodal_parsing_prompt
)
import sys
import logging
from ..cost_agent.agent import cost_agent
from ..diy_agent.agent import diy_agent
from ..service_agent.agent import service_agent
from ..coverage_agent.agent import coverage_agent
from ...agent_inputs import DiagnosisInput, DocsInput

logger = logging.getLogger(__name__)
load_dotenv()

def before_tool_callback(tool_context: ToolContext, **kwargs):
    # Ensure the user_id is set in the tool context state
    tool_context.state["user_id"] = tool_context._invocation_context.session.user_id


def analyse_multimodal_data(user_query: str, gcs_url: str, tool_context: ToolContext) -> str:
    """Analyzes multimodal data file.""" 
    diagnosis_text = "Unable to analyse media. Please retry again after sometime."
    
    # 1. Get text diagnosis using standard Gemini
    try:
        # Use google.genai with Vertex AI API configuration
        from google import genai
        from google.genai import types
        
        user_id = tool_context._invocation_context.session.user_id
        client = genai.Client(
            vertexai=True,
            project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
            location=os.environ.get("GOOGLE_CLOUD_LOCATION"),
            http_options=types.HttpOptions(api_version='v1')
        )
    
        mime_type = mimetypes.guess_type(gcs_url)[0]
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_text(text=user_query),
                types.Part.from_uri(file_uri=gcs_url, mime_type=mime_type)
            ],
            config=types.GenerateContentConfig(system_instruction=multimodal_parsing_prompt()),
        )
        try:
            diagnosis_text = response.candidates[0].content.parts[0].text
        except Exception as e:
            logger.error(f"Unable to parse response: {e}")
            diagnosis_text = "Unable to analyse media. Please retry again after sometime."
    except Exception as e:
        logger.error(f"Error parsing document type: {e}")
        diagnosis_text = "Unable to analyse media. Please retry again after sometime."

    # 2. Perform Object Detection and Annotation (if image)
    annotated_uri = None
    try:
        mime_type = mimetypes.guess_type(gcs_url)[0]
        if mime_type and mime_type.startswith('image/'):
            # Setup storage client
            storage_client = Client()
            bucket_name = gcs_url.replace("gs://", "").split("/")[0]
            blob_name = "/".join(gcs_url.replace("gs://", "").split("/")[1:])
            bucket = storage_client.bucket(bucket_name)
            blob = bucket.blob(blob_name)
            
            # Download to temp file
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_img:
                blob.download_to_filename(tmp_img.name)
                tmp_img_path = tmp_img.name
            
            try:
                # Run Object Detection
                async def run_detection():
                    gemini_api_key = os.environ.get("GEMINI_API_KEY")
                    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
                    
                    # Determine config based on available credentials
                    if gemini_api_key:
                        config = GeminiRoboticsConfig(
                            api_key=gemini_api_key,
                            use_vertex_ai=False
                        )
                    else:
                        config = GeminiRoboticsConfig(
                            project_id=project_id,
                            location=os.environ.get("GOOGLE_CLOUD_LOCATION") or "us-central1",
                            use_vertex_ai=True
                        )

                    async with GeminiRoboticsClient(config) as rob_client:
                        with open(tmp_img_path, "rb") as f:
                            img_bytes = f.read()
                        
                        prompt = f"Locate the issue described as: '{user_query}'. Point to the specific area."
                        return await rob_client.detect_objects(
                            image_data=img_bytes,
                            prompt=prompt,
                            max_objects=5
                        )
                
                # Execute async in sync context
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                
                if loop.is_running():
                     # If loop is running, we can't block it. 
                     # But we need the result.
                     # This is a hacky workaround for nested async calls
                     import concurrent.futures
                     with concurrent.futures.ThreadPoolExecutor() as pool:
                         future = pool.submit(asyncio.run, run_detection())
                         detection_response = future.result()
                else:
                     detection_response = loop.run_until_complete(run_detection())
                
                objects = detection_response.parse_detected_objects()
                
                if objects:
                    # Annotate Image
                    img = Image.open(tmp_img_path)
                    draw = ImageDraw.Draw(img)
                    
                    try:
                        font = ImageFont.truetype("Arial.ttf", 20)
                    except IOError:
                        font = ImageFont.load_default()
                        
                    width, height = img.size
                    
                    for obj in objects:
                        y, x = obj.point.to_list()
                        px = (x / 1000) * width
                        py = (y / 1000) * height
                        
                        r = 20
                        draw.ellipse((px-r, py-r, px+r, py+r), outline="red", width=3)
                        
                        if obj.label:
                            draw.text((px+r, py), obj.label, fill="red", font=font)
                    
                    # Save annotated image
                    annotated_path = tmp_img_path + "_annotated.jpg"
                    img.save(annotated_path)
                    
                    # Upload annotated image
                    annotated_blob_name = blob_name.replace(".jpg", "").replace(".png", "") + "_annotated.jpg"
                    annotated_blob = bucket.blob(annotated_blob_name)
                    annotated_blob.upload_from_filename(annotated_path)
                    
                    annotated_uri = f"gs://{bucket_name}/{annotated_blob_name}"
                    
                    # Cleanup annotated file
                    if os.path.exists(annotated_path):
                        os.remove(annotated_path)

            except Exception as e:
                logger.error(f"Error in object detection/annotation: {e}")
            finally:
                # Cleanup source tmp
                if os.path.exists(tmp_img_path):
                    os.remove(tmp_img_path)

    except Exception as e:
        logger.error(f"Error handling image annotation: {e}")

    # Return structured JSON
    result = {
        "diagnosis": diagnosis_text
    }
    if annotated_uri:
        result["annotated_media_uri"] = annotated_uri
        
    return json.dumps(result)


# Create agents
triage_agent = Agent(
    model='gemini-2.5-flash',
    name='triage_agent',
    description="Analyzes multimodal data and extracts the problem description.",
    instruction=triage_agent_instructions(),
    tools=[analyse_multimodal_data],
    input_schema=DiagnosisInput
)

# Coverage agent is now imported from its own module

# Main analysis agent calls all agents as tools
analysis_agent = Agent(
    name='analysis_agent',
    model='gemini-2.5-flash',
    description="Orchestrates Triage, Coverage, DIY, and Service agents to provide comprehensive problem analysis.",
    instruction=analysis_agent_instructions(),
    tools=[
        AgentTool(triage_agent),
        AgentTool(coverage_agent),
        AgentTool(diy_agent),
        AgentTool(service_agent),
        AgentTool(cost_agent)
    ],
    input_schema=DiagnosisInput,
    disallow_transfer_to_parent=True,
    before_tool_callback=before_tool_callback
)

__all__ = ["analysis_agent"]
