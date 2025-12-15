from typing import List, Optional, Dict
from pydantic import BaseModel

class AnalyzeCheckpointRequest(BaseModel):
    imageUrl: str
    contentType: str
    location: Optional[str] = None
    checkpointId: Optional[str] = None  # Required for Firestore update
    userId: Optional[str] = None  # Required for Firestore update
    propertyId: Optional[str] = None  # Required for Firestore update

class CheckpointAnalysisResponse(BaseModel):
    summary: str
    conditions: List[str]
    detectedItems: List[str]
    issues: List[str]

class CompareCheckpointsRequest(BaseModel):
    image1Url: str
    image2Url: str
    contentType1: str
    contentType2: str
    location: Optional[str] = None

class ChangeRegion(BaseModel):
    description: str
    changeType: str
    severity: str
    confidence: float
    bbox: Optional[Dict] = None

class CheckpointComparisonResponse(BaseModel):
    summary: str
    similarityScore: float
    semanticChanges: List[str]
    regions: List[ChangeRegion]

