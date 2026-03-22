from pydantic import BaseModel, Field


class TokenQuotaStatusRequest(BaseModel):
    user_id: str = Field(min_length=1, description="Firebase Auth UID")
