"""Mobile → web browser auth handoff (one-time codes)."""

from pydantic import BaseModel, Field


class MobileWebHandoffCreateRequest(BaseModel):
    returnPath: str = Field(
        default="/home/settings?tab=billing",
        description="In-app path after handoff (must start with /home)",
    )


class MobileWebHandoffCreateResponse(BaseModel):
    code: str
    expiresInSeconds: int


class MobileWebHandoffConsumeRequest(BaseModel):
    code: str


class MobileWebHandoffConsumeResponse(BaseModel):
    customToken: str
    returnPath: str
