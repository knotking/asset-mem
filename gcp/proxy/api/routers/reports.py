from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from google.cloud import firestore
import logging

from common.plan_limits import PlanLimitExceeded, check_monthly_report_generations_allowed
from common.storage.client import StorageError
from core.auth_deps import RATE_BUCKET_DOCUMENTS, authenticated_user
from core.firebase_auth import apply_uid_to_camel_user_id
from schemas.reports import (
    GenerateReportRequest,
    PublicReportSignedUrlRequest,
    ReportPreviewHtmlRequest,
    ReportPreviewRequest,
    ReportRagIndexRequest,
    ReportShareRequest,
    ReportSignedUrlRequest,
    ReportStatusRequest,
    UpdateReportMetadataRequest,
)
from services.report_service import (
    create_or_refresh_report_share,
    generate_public_report_signed_url,
    generate_report_signed_url,
    get_report_status,
    prepare_report_generation,
    prepare_report_preview,
    prepare_report_preview_html,
    set_report_rag_index,
    update_report_metadata,
)
from utils.plan_limit_http import plan_limit_exceeded_response

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/reports/preview", summary="Preview checkpoints resolved for a report")
async def reports_preview(
    request_data: ReportPreviewRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    apply_uid_to_camel_user_id(request_data, uid)
    if not request_data.propertyId:
        raise HTTPException(status_code=400, detail="propertyId is required")

    db = firestore.Client()
    try:
        return prepare_report_preview(db, request_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/reports/preview-html", summary="Server-rendered HTML preview for report layout")
async def reports_preview_html(
    request_data: ReportPreviewHtmlRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    apply_uid_to_camel_user_id(request_data, uid)
    if not request_data.propertyId:
        raise HTTPException(status_code=400, detail="propertyId is required")

    db = firestore.Client()
    try:
        return prepare_report_preview_html(db, request_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/reports/status", summary="Poll async report generation status")
async def reports_status(
    request_data: ReportStatusRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    apply_uid_to_camel_user_id(request_data, uid)
    if not request_data.propertyId or not request_data.reportId:
        raise HTTPException(status_code=400, detail="propertyId and reportId are required")

    db = firestore.Client()
    try:
        return get_report_status(db, request_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/reports/generate", summary="Generate a property report PDF (async)")
async def reports_generate(
    request_data: GenerateReportRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    apply_uid_to_camel_user_id(request_data, uid)
    if not request_data.propertyId or not request_data.title.strip():
        raise HTTPException(status_code=400, detail="propertyId and title are required")

    db = firestore.Client()
    try:
        check_monthly_report_generations_allowed(db, request_data.userId, 1)
    except PlanLimitExceeded as e:
        return plan_limit_exceeded_response(e)

    try:
        return prepare_report_generation(db, request_data)
    except PlanLimitExceeded as e:
        return plan_limit_exceeded_response(e)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        logger.exception("Report generation enqueue failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/reports/signed-url", summary="Get a short-lived signed URL for a report PDF")
async def reports_signed_url(
    request_data: ReportSignedUrlRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    apply_uid_to_camel_user_id(request_data, uid)
    db = firestore.Client()
    try:
        return await generate_report_signed_url(
            db,
            user_id=request_data.userId,
            property_id=request_data.propertyId,
            report_id=request_data.reportId,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except StorageError as e:
        logger.exception("Report signed URL failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/reports/metadata", summary="Update report title, notes, or template flags")
async def reports_update_metadata(
    request_data: UpdateReportMetadataRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    apply_uid_to_camel_user_id(request_data, uid)
    db = firestore.Client()
    try:
        return update_report_metadata(db, request_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/reports/share", summary="Create or refresh a public share link for a ready report")
async def reports_share(
    request_data: ReportShareRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    apply_uid_to_camel_user_id(request_data, uid)
    db = firestore.Client()
    try:
        return create_or_refresh_report_share(db, request_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post(
    "/reports/rag-index",
    summary="Opt in or out of Docs chat RAG indexing for a report markdown companion",
)
async def reports_rag_index(
    request_data: ReportRagIndexRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    apply_uid_to_camel_user_id(request_data, uid)
    db = firestore.Client()
    try:
        return set_report_rag_index(db, request_data)
    except PlanLimitExceeded as e:
        return plan_limit_exceeded_response(e)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        logger.exception("Report RAG index failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/reports/public-signed-url",
    summary="Get a signed PDF URL via public shareId (no auth)",
)
async def reports_public_signed_url(request_data: PublicReportSignedUrlRequest):
    db = firestore.Client()
    try:
        return await generate_public_report_signed_url(db, share_id=request_data.shareId)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except StorageError as e:
        logger.exception("Public report signed URL failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
