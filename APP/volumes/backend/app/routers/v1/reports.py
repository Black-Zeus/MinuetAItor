from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.management_topic_reports import (
    ManagementTopicReportRequest,
    ManagementTopicReportResponse,
)
from schemas.management_review_reports import (
    ManagementReviewObservationRequest,
    ManagementReviewObservationResponse,
)
from schemas.management_commitment_reports import (
    ManagementCommitmentReportRequest,
    ManagementCommitmentReportResponse,
)
from schemas.management_email_delivery_reports import (
    ManagementEmailDeliveryReportRequest,
    ManagementEmailDeliveryReportResponse,
)
from schemas.audit_reports import (
    AuditReportRequest,
    AuditReportResponse,
)
from schemas.report_exports import ReportPdfPreviewRequest
from services.auth_service import get_current_user
from services.management_topic_reports_service import list_management_topic_report
from services.reports_service import generate_report_pdf_preview

router = APIRouter(prefix="/reports", tags=["Reports"])
bearer = HTTPBearer(auto_error=False)


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


@router.post(
    "/audit/events",
    response_model=AuditReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Listar eventos y agregaciones para reportería de auditoría",
)
def audit_events_endpoint(
    body: AuditReportRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    from services.audit_reports_service import list_audit_report

    return list_audit_report(db, body)


@router.post(
    "/management/commitment-items",
    response_model=ManagementCommitmentReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Listar acuerdos y requerimientos documentales para reportería",
)
def management_commitment_items_endpoint(
    body: ManagementCommitmentReportRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    from services.management_commitment_reports_service import list_management_commitment_items

    return list_management_commitment_items(db, body)


@router.post(
    "/management/email-deliveries",
    response_model=ManagementEmailDeliveryReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Listar eventos históricos de correos para reportería",
)
def management_email_deliveries_endpoint(
    body: ManagementEmailDeliveryReportRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    from services.management_email_delivery_reports_service import list_management_email_deliveries

    return list_management_email_deliveries(db, body)


@router.post(
    "/management/review-observations",
    response_model=ManagementReviewObservationResponse,
    status_code=status.HTTP_200_OK,
    summary="Listar observaciones externas para reportería de revisión",
)
def management_review_observations_endpoint(
    body: ManagementReviewObservationRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    from services.management_review_reports_service import list_management_review_observations

    return list_management_review_observations(db, body)


@router.post(
    "/management/topic-analytics",
    response_model=ManagementTopicReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Generar agregaciones de reportería temática",
)
def management_topic_analytics_endpoint(
    body: ManagementTopicReportRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    return list_management_topic_report(db, body)


@router.post(
    "/pdf-preview",
    status_code=status.HTTP_200_OK,
    summary="Generar PDF temporal de vista previa para un reporte",
)
async def report_pdf_preview_endpoint(
    body: ReportPdfPreviewRequest,
    db: Session = Depends(get_db),
    session: UserSession = Depends(current_user_dep),
):
    pdf_bytes = await generate_report_pdf_preview(
        db=db,
        session=session,
        payload=body,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="report-preview.pdf"'},
    )
