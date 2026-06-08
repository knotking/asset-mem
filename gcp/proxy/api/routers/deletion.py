from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query
import logging

from core.auth_deps import RATE_BUCKET_DOCUMENTS, authenticated_user
from schemas.deletion import (
    AgentSessionsDeleteRequest,
    CheckpointDeletionRequest,
    CheckpointsBatchDeleteRequest,
    DeletionAuditListResponse,
    DeletionBatchResult,
    DeletionJobResponse,
    DocumentDeletionRequest,
    DocumentsBatchDeleteRequest,
    PropertyDeletionRequest,
    RagFilesDeleteRequest,
    SessionDeletionRequest,
    SessionsBatchDeleteRequest,
    SessionSharedChatsDeleteRequest,
    UserErasureRequest,
)
from services import deletion_service

router = APIRouter(tags=["Deletion"])
logger = logging.getLogger(__name__)


def _db():
    from google.cloud import firestore

    return firestore.Client()


@router.post("/deletion/document", summary="Delete a user document (Storage + Firestore + optional RAG)")
async def deletion_document(
    request_data: DocumentDeletionRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    if request_data.userId != uid:
        raise HTTPException(status_code=403, detail="userId mismatch")
    db = _db()
    result = deletion_service.run_audited_resource_deletion(
        db,
        user_id=uid,
        actor_uid=uid,
        resource_type="document",
        resource_ids=[request_data.docId],
        resource_ref=deletion_service._document_ref(db, uid, request_data.docId),
        operation=lambda: deletion_service.delete_document_asset(
            db,
            uid,
            request_data.docId,
            request_data.storagePath,
            request_data.gsURI,
        ),
    )
    return {"status": "ok", **result}


@router.post("/deletion/checkpoint", summary="Delete a checkpoint and its media")
async def deletion_checkpoint(
    request_data: CheckpointDeletionRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    if request_data.userId != uid:
        raise HTTPException(status_code=403, detail="userId mismatch")
    db = _db()
    result = deletion_service.run_audited_resource_deletion(
        db,
        user_id=uid,
        actor_uid=uid,
        resource_type="checkpoint",
        resource_ids=[request_data.checkpointId],
        property_id=request_data.propertyId,
        resource_ref=deletion_service._checkpoint_ref(
            db, uid, request_data.propertyId, request_data.checkpointId
        ),
        operation=lambda: deletion_service.delete_checkpoint_asset(
            db, uid, request_data.propertyId, request_data.checkpointId
        ),
    )
    return {"status": "ok", **result}


@router.post("/deletion/session", summary="Delete a chat session (messages, agent session, shared chats)")
async def deletion_session(
    request_data: SessionDeletionRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    if request_data.userId != uid:
        raise HTTPException(status_code=403, detail="userId mismatch")
    db = _db()
    result = deletion_service.run_audited_resource_deletion(
        db,
        user_id=uid,
        actor_uid=uid,
        resource_type="session",
        resource_ids=[request_data.sessionId],
        resource_ref=deletion_service._chat_ref(db, uid, request_data.sessionId),
        operation=lambda: deletion_service.delete_chat_session_full(db, uid, request_data.sessionId),
    )
    return {"status": "ok", **result}


@router.post(
    "/deletion/checkpoints",
    summary="Batch delete checkpoints",
    response_model=DeletionBatchResult,
)
async def deletion_checkpoints_batch(
    request_data: CheckpointsBatchDeleteRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    if request_data.userId != uid:
        raise HTTPException(status_code=403, detail="userId mismatch")
    try:
        db = _db()
        result = deletion_service.delete_checkpoints_batch(
            db, uid, request_data.propertyId, request_data.checkpointIds
        )
        return DeletionBatchResult(**result)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc


@router.post(
    "/deletion/documents",
    summary="Batch delete documents",
    response_model=DeletionBatchResult,
)
async def deletion_documents_batch(
    request_data: DocumentsBatchDeleteRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    if request_data.userId != uid:
        raise HTTPException(status_code=403, detail="userId mismatch")
    try:
        db = _db()
        items = [item.model_dump() for item in request_data.items]
        result = deletion_service.delete_documents_batch(db, uid, items)
        return DeletionBatchResult(**result)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc


@router.post(
    "/deletion/sessions",
    summary="Batch delete chat sessions",
    response_model=DeletionBatchResult,
)
async def deletion_sessions_batch(
    request_data: SessionsBatchDeleteRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    if request_data.userId != uid:
        raise HTTPException(status_code=403, detail="userId mismatch")
    try:
        db = _db()
        result = deletion_service.delete_sessions_batch(db, uid, request_data.sessionIds)
        return DeletionBatchResult(**result)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc


@router.post("/deletion/rag-files", summary="Delete RAG files for GCS URIs")
async def deletion_rag_files(
    request_data: RagFilesDeleteRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    if request_data.userId != uid:
        raise HTTPException(status_code=403, detail="userId mismatch")
    result = deletion_service.delete_rag_files(request_data.gsURIs)
    deletion_service._log_deletion_action(
        resource_type="rag",
        user_id=uid,
        resource_ids=request_data.gsURIs,
        status="completed",
    )
    return {"status": "ok", **result}


@router.post("/deletion/agent-sessions", summary="Batch delete Vertex agent sessions")
async def deletion_agent_sessions(
    request_data: AgentSessionsDeleteRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    if request_data.userId != uid:
        raise HTTPException(status_code=403, detail="userId mismatch")
    result = deletion_service.delete_agent_sessions(uid, request_data.sessionIds)
    deletion_service._log_deletion_action(
        resource_type="vertex",
        user_id=uid,
        resource_ids=request_data.sessionIds,
        status="completed",
    )
    return {"status": "ok", **result}


@router.post("/deletion/session-shared-chats", summary="Delete shared chat copies for a session")
async def deletion_session_shared_chats(
    request_data: SessionSharedChatsDeleteRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    if request_data.userId != uid:
        raise HTTPException(status_code=403, detail="userId mismatch")
    db = _db()
    result = deletion_service.delete_shared_chats_for_session(db, uid, request_data.sessionId)
    return {"status": "ok", **result}


@router.post("/deletion/property", summary="Start property deletion job")
async def deletion_property(
    request_data: PropertyDeletionRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    if request_data.userId != uid:
        raise HTTPException(status_code=403, detail="userId mismatch")
    db = _db()
    deletion_service._write_audit_event(
        db,
        user_id=uid,
        actor_uid=uid,
        resource_type="property",
        resource_ids=[request_data.propertyId],
        property_id=request_data.propertyId,
        source="ui",
        status="started",
        job_id=deletion_service._property_job_id(request_data.propertyId),
    )
    job_id = deletion_service.start_property_deletion_job(uid, request_data.propertyId)
    return {"status": "ok", "jobId": job_id}


@router.get("/deletion/jobs/{job_id}", summary="Get deletion job status", response_model=DeletionJobResponse)
async def deletion_job_status(
    job_id: str,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    job = deletion_service.get_deletion_job(uid, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return DeletionJobResponse(**job)


@router.get("/deletion/audit", summary="List deletion audit events (admin or self)")
async def deletion_audit_list(
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
    userId: Annotated[str, Query()],
    x_data_erasure_admin_secret: Annotated[str | None, Header()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
):
    if userId != uid and not deletion_service.verify_data_erasure_admin_secret(
        x_data_erasure_admin_secret
    ):
        raise HTTPException(status_code=403, detail="Admin secret required for other users")
    db = _db()
    events = deletion_service.list_deletion_audit(db, userId, limit=limit)
    return DeletionAuditListResponse(events=events)


@router.post("/deletion/user", summary="Start full user data erasure (admin)")
async def deletion_user(
    request_data: UserErasureRequest,
    x_data_erasure_admin_secret: Annotated[str | None, Header()] = None,
):
    if not deletion_service.verify_data_erasure_admin_secret(x_data_erasure_admin_secret):
        raise HTTPException(status_code=403, detail="Admin secret required")
    db = _db()
    job_id = f"user_{request_data.userId}"
    deletion_service._write_audit_event(
        db,
        user_id=request_data.userId,
        actor_uid=request_data.userId,
        resource_type="user",
        resource_ids=[request_data.userId],
        source="admin",
        status="started",
        job_id=job_id,
    )
    job_id = deletion_service.start_user_erasure_job(request_data.userId)
    return {"status": "ok", "jobId": job_id}
