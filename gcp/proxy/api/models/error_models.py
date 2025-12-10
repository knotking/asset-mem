"""
Error Response Models

Standardized error response models for consistent API error handling.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """Detailed error information."""
    
    field: Optional[str] = Field(default=None, description="Field name if validation error")
    message: str = Field(description="Error message")
    code: Optional[str] = Field(default=None, description="Error code")


class ErrorResponse(BaseModel):
    """Standardized error response model."""
    
    status: str = Field(default="error", description="Status indicator")
    message: str = Field(description="Error message")
    error_code: Optional[str] = Field(default=None, description="Application error code")
    details: Optional[List[ErrorDetail]] = Field(default=None, description="Detailed error information")
    request_id: Optional[str] = Field(default=None, description="Request correlation ID")
    
    def model_dump_dict(self) -> Dict[str, Any]:
        """Return as dictionary, excluding None values."""
        return {k: v for k, v in self.model_dump().items() if v is not None}
