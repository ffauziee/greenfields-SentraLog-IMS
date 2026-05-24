from typing import Optional

from fastapi import APIRouter, Depends, Query

from ..schemas.incident import IncidentCreate, IncidentUpdate
from ..services import incident_service
from ..utils.auth import get_current_user, require_role

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("/dashboard")
def get_dashboard(current_user: dict = Depends(get_current_user)):
    return incident_service.get_dashboard_data()


@router.get("")
def list_incidents(
    search: Optional[str] = Query(None),
    severity: Optional[int] = Query(None),
    status: Optional[int] = Query(None),
    status_group: Optional[str] = Query("active"),
    assigned_to_me: Optional[bool] = Query(False),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    return incident_service.list_incidents(
        role=current_user["role"],
        user_id=current_user["id"],
        search=search,
        severity=severity,
        status=status,
        status_group=status_group,
        assigned_to_me=assigned_to_me,
        page=page,
        limit=limit,
    )


@router.get("/export")
def export_incidents(
    search: Optional[str] = Query(None),
    severity: Optional[int] = Query(None),
    status_group: Optional[str] = Query("active"),
    assigned_to_me: Optional[bool] = Query(False),
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user),
):
    return incident_service.export_incidents_csv(
        role=current_user["role"],
        user_id=current_user["id"],
        search=search,
        severity=severity,
        status_group=status_group,
        assigned_to_me=assigned_to_me,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/{incident_id}")
def get_incident(incident_id: str, current_user: dict = Depends(get_current_user)):
    return incident_service.get_incident_detail(incident_id)


@router.post("")
def create_incident(
    data: IncidentCreate, current_user: dict = Depends(get_current_user)
):
    return incident_service.create_incident(data, current_user)


@router.put("/{incident_id}")
def update_incident(
    incident_id: str,
    data: IncidentUpdate,
    current_user: dict = Depends(get_current_user),
):
    return incident_service.update_incident(incident_id, data, current_user)


@router.delete("/{incident_id}/comments/{comment_id}")
def delete_comment(
    incident_id: str,
    comment_id: str,
    current_user: dict = Depends(require_role(["admin"])),
):
    return incident_service.delete_comment(incident_id, comment_id, current_user)


@router.delete("/{incident_id}")
def delete_incident(incident_id: str, current_user: dict = Depends(get_current_user)):
    return incident_service.delete_incident(incident_id, current_user)
