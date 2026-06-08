from pydantic import BaseModel, Field


class RagFilesDeleteRequest(BaseModel):
    userId: str
    gsURIs: list[str] = Field(default_factory=list)


class AgentSessionsDeleteRequest(BaseModel):
    userId: str
    sessionIds: list[str] = Field(default_factory=list)


class PropertyDeletionRequest(BaseModel):
    userId: str
    propertyId: str


class SessionSharedChatsDeleteRequest(BaseModel):
    userId: str
    sessionId: str


class UserErasureRequest(BaseModel):
    userId: str


class DocumentDeletionRequest(BaseModel):
    userId: str
    docId: str
    storagePath: str | None = None
    gsURI: str | None = None


class CheckpointDeletionRequest(BaseModel):
    userId: str
    propertyId: str
    checkpointId: str


class SessionDeletionRequest(BaseModel):
    userId: str
    sessionId: str


class DeletionJobResponse(BaseModel):
    jobId: str
    status: str
    phase: str | None = None
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None
    attempt: int = 0
    canRetry: bool = False


class DocumentBatchItem(BaseModel):
    docId: str
    storagePath: str | None = None
    gsURI: str | None = None


class DocumentsBatchDeleteRequest(BaseModel):
    userId: str
    items: list[DocumentBatchItem] = Field(default_factory=list)


class CheckpointsBatchDeleteRequest(BaseModel):
    userId: str
    propertyId: str
    checkpointIds: list[str] = Field(default_factory=list)


class SessionsBatchDeleteRequest(BaseModel):
    userId: str
    sessionIds: list[str] = Field(default_factory=list)


class DeletionFailureItem(BaseModel):
    resource: str
    message: str


class DeletionBatchResult(BaseModel):
    ok: bool = True
    deleted: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    failed: list[DeletionFailureItem] = Field(default_factory=list)


class DeletionAuditEvent(BaseModel):
    eventId: str
    userId: str
    actorUid: str
    resourceType: str
    resourceIds: list[str] = Field(default_factory=list)
    propertyId: str | None = None
    jobId: str | None = None
    source: str = "api"
    status: str
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None
    createdAt: str | None = None
    completedAt: str | None = None


class DeletionAuditListResponse(BaseModel):
    events: list[DeletionAuditEvent] = Field(default_factory=list)
