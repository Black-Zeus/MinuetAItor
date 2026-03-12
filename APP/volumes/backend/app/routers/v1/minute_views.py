from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.minute_views import (
    MinuteViewAccessRequest,
    MinuteViewAccessRequestResponse,
    MinuteViewDetailResponse,
    MinuteViewObservationCreateRequest,
    MinuteViewObservationCreateResponse,
    MinuteViewOtpVerifyRequest,
    MinuteViewSessionResponse,
)
from services.minute_views_service import (
    create_minute_view_observation,
    get_current_visitor_session,
    get_minute_view_detail,
    get_minute_view_pdf_bytes,
    logout_current_visitor_session,
    request_minute_view_otp,
    verify_minute_view_otp,
)

router = APIRouter(prefix="/minutes/public", tags=["MinuteViews"])


async def current_visitor_dep(
    record_id: str,
    db: Session = Depends(get_db),
    x_visitor_token: str | None = Header(None, alias="X-Visitor-Token"),
):
    if not x_visitor_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falta token de visitante")
    return await get_current_visitor_session(x_visitor_token, record_id, db)


@router.post(
    "/access/request-otp",
    response_model=MinuteViewAccessRequestResponse,
    status_code=status.HTTP_200_OK,
)
async def request_otp_endpoint(
    body: MinuteViewAccessRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    return await request_minute_view_otp(
        db,
        record_id=body.record_id,
        email=body.email,
        request=request,
    )


@router.post(
    "/access/verify-otp",
    response_model=MinuteViewSessionResponse,
    status_code=status.HTTP_200_OK,
)
async def verify_otp_endpoint(
    body: MinuteViewOtpVerifyRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    return await verify_minute_view_otp(
        db,
        record_id=body.record_id,
        email=body.email,
        otp_code=body.otp_code,
        request=request,
    )


@router.get(
    "/{record_id}",
    response_model=MinuteViewDetailResponse,
    status_code=status.HTTP_200_OK,
)
async def detail_endpoint(
    record_id: str,
    db: Session = Depends(get_db),
    visitor_session=Depends(current_visitor_dep),
):
    return get_minute_view_detail(db, record_id=record_id, visitor_session=visitor_session)


@router.get(
    "/{record_id}/pdf",
    status_code=status.HTTP_200_OK,
)
async def pdf_endpoint(
    record_id: str,
    db: Session = Depends(get_db),
    visitor_session=Depends(current_visitor_dep),
):
    pdf_bytes, filename = get_minute_view_pdf_bytes(db, record_id=record_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.post(
    "/{record_id}/observations",
    response_model=MinuteViewObservationCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_observation_endpoint(
    record_id: str,
    body: MinuteViewObservationCreateRequest,
    db: Session = Depends(get_db),
    visitor_session=Depends(current_visitor_dep),
):
    return create_minute_view_observation(
        db,
        record_id=record_id,
        body=body.body,
        visitor_session=visitor_session,
    )


@router.post(
    "/{record_id}/logout",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def logout_endpoint(
    record_id: str,
    db: Session = Depends(get_db),
    x_visitor_token: str | None = Header(None, alias="X-Visitor-Token"),
):
    if not x_visitor_token:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    await logout_current_visitor_session(x_visitor_token, record_id, db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
