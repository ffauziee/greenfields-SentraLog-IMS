import csv
import io
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from ..core.config import get_settings
from ..core.constants import (
    ALLOWED_OPERATOR_TRANSITIONS,
    STATUS_ACTIVE,
    STATUS_ARCHIVED,
    STATUS_CLOSED,
    STATUS_RESOLVED,
    STATUS_UNASSIGNED,
)
from ..db.database import execute, query_all, query_one
from ..schemas.incident import IncidentCreate, IncidentUpdate
from ..services.attention import calculate_attention_score
from ..services.audit import create_audit_log
from ..utils.auth import get_current_user

router = APIRouter(prefix="/api/incidents", tags=["incidents"])
settings = get_settings()


def is_admin_role(role: str) -> bool:
    return role in ("superadmin", "admin")


def validate_status_transition(current_status_id: int, new_status_id: int, role: str):
    if is_admin_role(role):
        return
    allowed = ALLOWED_OPERATOR_TRANSITIONS.get(current_status_id, [])
    if new_status_id not in allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Operator cannot change status from {current_status_id} to {new_status_id}. Allowed: {allowed}"
            if allowed
            else "Operator cannot change status from current state (no transitions allowed)",
        )


INCIDENT_COLS = "i.id, i.title, i.severity_id, i.status_id, i.location, i.assigned_to, i.reported_by, i.is_resolved, i.created_at, i.updated_at"


@router.get("/dashboard")
def get_dashboard(current_user: dict = Depends(get_current_user)):
    """Return dashboard aggregates and attention-prioritized incidents."""

    status_param = (STATUS_ACTIVE,)

    counts = query_one(
        """SELECT
               COUNT(*) as total_open,
               COUNT(*) FILTER (WHERE s.name = 'CRITICAL') as critical_count,
               COUNT(*) FILTER (WHERE i.assigned_to IS NULL) as unassigned_count
           FROM incidents i
           JOIN severity_levels s ON i.severity_id = s.id
           WHERE i.is_deleted = FALSE AND i.status_id IN %s""",
        status_param,
    )

    past_sla_count = query_one(
        """SELECT COUNT(*) as count FROM incidents i
           JOIN severity_levels s ON i.severity_id = s.id
           WHERE i.is_deleted = FALSE AND i.status_id IN %s
             AND i.created_at < NOW() - (s.sla_hours || ' hours')::INTERVAL""",
        status_param,
    )

    recent = query_all(
        """SELECT i.id, i.title, i.assigned_to, s.name as severity_name, s.color as severity_color,
                  s.level as severity_level, st.name as status_name,
                  u.username as reported_by_name, i.created_at
           FROM incidents i
           JOIN severity_levels s ON i.severity_id = s.id
           JOIN incident_statuses st ON i.status_id = st.id
           JOIN users u ON i.reported_by = u.id
           WHERE i.is_deleted = FALSE AND i.status_id IN %s
           ORDER BY s.level DESC, i.created_at DESC
           LIMIT 10""",
        status_param,
    )

    attention = query_all(
        f"""SELECT {INCIDENT_COLS}, s.name as severity_name, s.color as severity_color,
                   s.level as severity_level, s.sla_hours,
                   st.name as status_name,
                   u.username as reported_by_name,
                   a.username as assigned_to_name,
                   EXTRACT(EPOCH FROM (NOW() - i.created_at))/3600 as age_hours
            FROM incidents i
            JOIN severity_levels s ON i.severity_id = s.id
            JOIN incident_statuses st ON i.status_id = st.id
            JOIN users u ON i.reported_by = u.id
            LEFT JOIN users a ON i.assigned_to = a.id
            WHERE i.is_deleted = FALSE AND i.status_id IN %s
            ORDER BY
                CASE WHEN st.name IN ('OPEN', 'ESCALATED') THEN 0 ELSE 1 END,
                s.level DESC,
                CASE WHEN i.created_at < NOW() - (s.sla_hours || ' hours')::INTERVAL THEN 0 ELSE 1 END,
                i.created_at ASC
            LIMIT %s""",
        status_param + (settings.DASHBOARD_ATTENTION_LIMIT,),
    )

    for inc in attention:
        inc["attention_score"] = calculate_attention_score(inc, inc.get("age_hours", 0))

    return {
        "total_open": counts["total_open"],
        "critical_count": counts["critical_count"],
        "unassigned_count": counts["unassigned_count"],
        "past_sla_count": past_sla_count["count"],
        "recent": recent,
        "attention_incidents": attention,
    }


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
    """List incidents with optional search, severity, status, and role-based scoping."""
    role = current_user["role"]
    user_id = current_user["id"]
    offset = (page - 1) * limit
    conditions = ["i.is_deleted = FALSE"]
    params = []

    if status_group == "archived":
        conditions.append("i.status_id IN %s")
        params.append(STATUS_ARCHIVED)
    elif status_group == "unassigned":
        if not is_admin_role(role):
            raise HTTPException(
                status_code=403, detail="Only admin can view unassigned incidents"
            )
        conditions.append("i.status_id IN %s AND i.assigned_to IS NULL")
        params.append(STATUS_UNASSIGNED)
    else:
        conditions.append("i.status_id IN %s")
        params.append(STATUS_ACTIVE)

    if assigned_to_me:
        conditions.append("i.assigned_to = %s")
        params.append(user_id)

    if search:
        conditions.append("(i.title ILIKE %s OR i.description ILIKE %s)")
        params.extend([f"%{search}%", f"%{search}%"])
    if severity:
        conditions.append("i.severity_id = %s")
        params.append(severity)
    if status:
        conditions.append("i.status_id = %s")
        params.append(status)

    where_clause = " AND ".join(conditions)

    total = query_one(
        f"SELECT COUNT(*) as count FROM incidents i WHERE {where_clause}", tuple(params)
    )
    incidents = query_all(
        f"""
        SELECT {INCIDENT_COLS}, s.name as severity_name, s.color as severity_color,
               s.level as severity_level, st.name as status_name,
               u.username as reported_by_name,
               a.username as assigned_to_name
        FROM incidents i
        JOIN severity_levels s ON i.severity_id = s.id
        JOIN incident_statuses st ON i.status_id = st.id
        JOIN users u ON i.reported_by = u.id
        LEFT JOIN users a ON i.assigned_to = a.id
        WHERE {where_clause}
        ORDER BY s.level DESC, i.created_at DESC
        LIMIT %s OFFSET %s
    """,
        tuple(params) + (limit, offset),
    )

    return {
        "total": total["count"],
        "page": page,
        "limit": limit,
        "data": incidents,
    }


@router.get("/export")
def export_incidents(
    search: Optional[str] = Query(None),
    severity: Optional[int] = Query(None),
    status_group: Optional[str] = Query("active"),
    assigned_to_me: Optional[bool] = Query(False),
    current_user: dict = Depends(get_current_user),
):
    """Export filtered incidents as a CSV file."""
    role = current_user["role"]
    user_id = current_user["id"]
    conditions = ["i.is_deleted = FALSE"]
    params = []

    if status_group == "archived":
        conditions.append("i.status_id IN %s")
        params.append(STATUS_ARCHIVED)
    elif status_group == "unassigned":
        if not is_admin_role(role):
            raise HTTPException(
                status_code=403, detail="Only admin can view unassigned incidents"
            )
        conditions.append("i.status_id IN %s AND i.assigned_to IS NULL")
        params.append(STATUS_UNASSIGNED)
    else:
        conditions.append("i.status_id IN %s")
        params.append(STATUS_ACTIVE)

    if assigned_to_me:
        conditions.append("i.assigned_to = %s")
        params.append(user_id)

    if search:
        conditions.append("(i.title ILIKE %s OR i.description ILIKE %s)")
        params.extend([f"%{search}%", f"%{search}%"])
    if severity:
        conditions.append("i.severity_id = %s")
        params.append(severity)

    where_clause = " AND ".join(conditions)

    incidents = query_all(
        f"""
        SELECT {INCIDENT_COLS}, s.name as severity_name, s.color as severity_color,
               s.level as severity_level, s.sla_hours,
               st.name as status_name,
               u.username as reported_by_name,
               a.username as assigned_to_name
        FROM incidents i
        JOIN severity_levels s ON i.severity_id = s.id
        JOIN incident_statuses st ON i.status_id = st.id
        JOIN users u ON i.reported_by = u.id
        LEFT JOIN users a ON i.assigned_to = a.id
        WHERE {where_clause}
        ORDER BY s.level DESC, i.created_at DESC
    """,
        tuple(params),
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "ID",
            "Title",
            "Severity",
            "Status",
            "Location",
            "Reported By",
            "Assigned To",
            "Created At",
            "Resolved At",
            "SLA Hours",
            "Attention Score",
        ]
    )

    for inc in incidents:
        age_hours = (
            (
                datetime.now(timezone.utc)
                - inc["created_at"].replace(tzinfo=timezone.utc)
            ).total_seconds()
            / 3600
            if inc["created_at"]
            else 0
        )
        attn_data = {**inc, "age_hours": age_hours}
        score = calculate_attention_score(attn_data, age_hours)
        writer.writerow(
            [
                inc["id"],
                inc["title"],
                inc["severity_name"],
                inc["status_name"],
                inc.get("location") or "",
                inc["reported_by_name"],
                inc.get("assigned_to_name") or "",
                inc["created_at"].isoformat() if inc.get("created_at") else "",
                inc["resolved_at"].isoformat() if inc.get("resolved_at") else "",
                inc.get("sla_hours") or "",
                score,
            ]
        )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=incidents_export.csv"},
    )


INCIDENT_DETAIL_COLS = f"""{INCIDENT_COLS}, i.description, i.resolved_at,
       s.name as severity_name, s.color as severity_color,
       s.level as severity_level, s.sla_hours,
       st.name as status_name,
       u.username as reported_by_name,
       a.username as assigned_to_name"""


@router.get("/{incident_id}")
def get_incident(incident_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single incident by ID with its comments."""
    incident = query_one(
        f"""
        SELECT {INCIDENT_DETAIL_COLS}
        FROM incidents i
        JOIN severity_levels s ON i.severity_id = s.id
        JOIN incident_statuses st ON i.status_id = st.id
        JOIN users u ON i.reported_by = u.id
        LEFT JOIN users a ON i.assigned_to = a.id
        WHERE i.id = %s AND i.is_deleted = FALSE
    """,
        (incident_id,),
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    comments = query_all(
        """
        SELECT c.id, c.content, c.user_id, c.created_at, u.username
        FROM incident_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.incident_id = %s
        ORDER BY c.created_at DESC
    """,
        (incident_id,),
    )
    incident["comments"] = comments
    return incident


@router.post("")
def create_incident(
    data: IncidentCreate, current_user: dict = Depends(get_current_user)
):
    """Create a new incident. Operator cannot assign to others; admin may assign freely."""
    role = current_user["role"]
    user_id = current_user["id"]

    assigned_to = data.assigned_to
    if role == "operator":
        if assigned_to is not None:
            raise HTTPException(
                status_code=403, detail="Operator cannot assign incidents"
            )
        assigned_to = None
    elif is_admin_role(role) and assigned_to is None:
        pass

    incident = query_one(
        """
        INSERT INTO incidents (title, description, severity_id, location, assigned_to, reported_by)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """,
        (
            data.title,
            data.description,
            data.severity_id,
            data.location,
            assigned_to,
            user_id,
        ),
    )

    create_audit_log(
        user_id,
        "CREATE",
        "incident",
        incident["id"],
        None,
        {
            "title": data.title,
            "severity_id": data.severity_id,
            "assigned_to": assigned_to,
        },
    )
    return {"message": "Incident created", "id": incident["id"]}


@router.put("/{incident_id}")
def update_incident(
    incident_id: str,
    data: IncidentUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update an incident's fields. Operator can only update own incidents; only admin can reassign."""
    role = current_user["role"]
    user_id = current_user["id"]

    existing = query_one(
        f"SELECT {INCIDENT_COLS} FROM incidents i WHERE i.id = %s AND i.is_deleted = FALSE", (incident_id,)
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Incident not found")

    if role == "operator" and str(existing["assigned_to"]) != user_id:
        raise HTTPException(
            status_code=403, detail="You can only update incidents assigned to you"
        )

    updates = {}
    if data.title is not None:
        updates["title"] = data.title
    if data.description is not None:
        updates["description"] = data.description
    if data.severity_id is not None:
        updates["severity_id"] = data.severity_id
    if data.status_id is not None:
        validate_status_transition(existing["status_id"], data.status_id, role)
        updates["status_id"] = data.status_id
        if data.status_id in (STATUS_RESOLVED, STATUS_CLOSED):
            updates["is_resolved"] = True
            updates["resolved_at"] = datetime.now(timezone.utc)
    if data.location is not None:
        updates["location"] = data.location
    if data.assigned_to is not None:
        if not is_admin_role(role):
            raise HTTPException(
                status_code=403, detail="Only admin can reassign incidents"
            )
        updates["assigned_to"] = data.assigned_to

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    if role == "operator":
        allowed = {"status_id", "is_resolved", "resolved_at"}
        updates = {k: v for k, v in updates.items() if k in allowed}
        if not updates:
            raise HTTPException(
                status_code=403, detail="Operator can only change incident status"
            )
    set_clause = ", ".join([f"{k} = %s" for k in updates.keys()])
    updates["updated_at"] = datetime.now(timezone.utc)
    set_clause += ", updated_at = %s"
    values = list(updates.values()) + [incident_id]
    execute(f"UPDATE incidents SET {set_clause} WHERE id = %s", tuple(values))
    create_audit_log(
        user_id, "UPDATE", "incident", incident_id, dict(existing), updates
    )
    return {"message": "Incident updated"}


@router.delete("/{incident_id}")
def delete_incident(incident_id: str, current_user: dict = Depends(get_current_user)):
    """Soft-delete an incident. Operator can only delete own assigned incidents."""
    role = current_user["role"]
    user_id = current_user["id"]

    existing = query_one(
        f"SELECT {INCIDENT_COLS} FROM incidents i WHERE i.id = %s AND i.is_deleted = FALSE", (incident_id,)
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Incident not found")

    if not is_admin_role(role):
        raise HTTPException(
            status_code=403, detail="Only admin can delete incidents"
        )

    execute(
        "UPDATE incidents SET is_deleted = TRUE, updated_at = %s WHERE id = %s",
        (datetime.now(timezone.utc), incident_id),
    )
    create_audit_log(user_id, "DELETE", "incident", incident_id, dict(existing), None)
    return {"message": "Incident deleted"}
