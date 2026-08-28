"""Read-only endpoints for assistant audit logs."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.core.security import get_current_active_user

router = APIRouter(prefix="/api/v1/audit-logs", tags=["audit-logs"])


@router.get("", response_model=list[schemas.AuditLogResponse])
def list_audit_logs(
    session_id: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1),
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[models.AuditLog]:
    """Return only the authenticated user's audit logs."""
    query = db.query(models.AuditLog).filter(
        models.AuditLog.user_id == current_user.id
    )
    if session_id is not None:
        query = query.filter(models.AuditLog.session_id == session_id)

    return (
        query.order_by(
            models.AuditLog.created_at.desc(),
            models.AuditLog.id.desc(),
        )
        .limit(limit)
        .all()
    )


@router.get("/{audit_id}", response_model=schemas.AuditLogResponse)
def get_audit_log(
    audit_id: UUID,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> models.AuditLog:
    """Return one of the authenticated user's audit logs."""
    audit_log = (
        db.query(models.AuditLog)
        .filter(
            models.AuditLog.id == str(audit_id),
            models.AuditLog.user_id == current_user.id,
        )
        .first()
    )
    if audit_log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit log not found",
        )
    return audit_log
