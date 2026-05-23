from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.report_exports import ReportPdfPreviewRequest
from services.auth_service import get_current_user
from services.reports_service import generate_report_pdf_preview

router = APIRouter(prefix="/reports", tags=["Reports"])
bearer = HTTPBearer(auto_error=False)


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


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

