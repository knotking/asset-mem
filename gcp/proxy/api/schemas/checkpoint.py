from typing import List, Optional
from pydantic import BaseModel

class AnalyzeCheckpointRequest(BaseModel):
    imageUrl: str
    contentType: str
    location: Optional[str] = None

class CheckpointAnalysisResponse(BaseModel):
    summary: str
    conditions: List[str]
    detectedItems: List[str]
    issues: List[str]

