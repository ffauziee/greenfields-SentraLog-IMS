from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from ..db.database import query_one
from ..core.config import get_settings
from ..core.constants import ALLOWED_OPERATOR_TRANSITIONS, STATUS_CLOSED, STATUS_RESOLVED
from ..repositories.filters import IncidentFilter
from ..repositories import incident_repository as repo
from ..services.attention import calculate_attention_score
from ..services.audit import create_audit_log

settings = get_settings()

ADMIN_ROLES = ("superadmin", "admin")


def is_admin_role(role: str) -> bool:
    return role in ADMIN_ROLES


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


def get_dashboard_data():
    result = repo.get_dashboard_data()

    data = {
        **result["counts"],
        "past_sla_count": result["past_sla_count"],
        "recent": result["recent"],
        "attention_incidents": result["attention_incidents"],
    }

    for inc in data["attention_incidents"]:
        inc["attention_score"] = calculate_attention_score(inc, inc.get("age_hours", 0))

    return data


def list_incidents(
    role: str,
    user_id: str,
    search: Optional[str] = None,
    severity: Optional[int] = None,
    status: Optional[int] = None,
    status_group: str = "active",
    assigned_to_me: bool = False,
    page: int = 1,
    limit: int = 20,
):
    if status_group == "unassigned" and not is_admin_role(role):
        raise HTTPException(status_code=403, detail="Only admin can view unassigned incidents")

    f = IncidentFilter()
    f.by_status_group(status_group)
    f.by_assigned_to(user_id if assigned_to_me else None)
    f.by_search(search)
    f.by_severity(severity)
    f.by_status(status)

    where, params = f.build()
    offset = (page - 1) * limit

    total = repo.count_incidents_simple(where, params)["count"]
    incidents = repo.find_incidents(where, params, limit, offset)

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "data": incidents,
    }


def _csv_escape(val):
    s = str(val) if val is not None else ""
    if "," in s or '"' in s or "\n" in s:
        s = '"' + s.replace('"', '""') + '"'
    return s


def export_incidents_csv(
    role: str,
    user_id: str,
    search: Optional[str] = None,
    severity: Optional[int] = None,
    status_group: str = "active",
    assigned_to_me: bool = False,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    if status_group == "unassigned" and not is_admin_role(role):
        raise HTTPException(status_code=403, detail="Only admin can view unassigned incidents")

    f = IncidentFilter()
    f.by_status_group(status_group)
    f.by_assigned_to(user_id if assigned_to_me else None)
    f.by_search(search)
    f.by_severity(severity)
    f.by_date_range(date_from, date_to)

    where, params = f.build()

    header = [
        "ID", "Title", "Severity", "Status", "Location",
        "Reported By", "Assigned To", "Created At", "Resolved At",
        "SLA Hours", "Attention Score",
    ]

    def generate():
        yield ",".join(header) + "\n"
        now = datetime.now(timezone.utc)
        for inc in repo.stream_all_incidents(where, params):
            age_hours = (
                (now - inc["created_at"].replace(tzinfo=timezone.utc)).total_seconds() / 3600
                if inc.get("created_at") else 0
            )
            attn_data = {**inc, "age_hours": age_hours}
            score = calculate_attention_score(attn_data, age_hours)
            yield ",".join([
                _csv_escape(inc["id"]),
                _csv_escape(inc["title"]),
                _csv_escape(inc["severity_name"]),
                _csv_escape(inc["status_name"]),
                _csv_escape(inc.get("location") or ""),
                _csv_escape(inc["reported_by_name"]),
                _csv_escape(inc.get("assigned_to_name") or ""),
                _csv_escape(inc["created_at"].isoformat() if inc.get("created_at") else ""),
                _csv_escape(inc["resolved_at"].isoformat() if inc.get("resolved_at") else ""),
                _csv_escape(inc.get("sla_hours") or ""),
                _csv_escape(score),
            ]) + "\n"

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=incidents_export.csv"},
    )


def get_incident_detail(incident_id: str):
    incident = repo.find_incident_by_id(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident["comments"] = repo.get_incident_comments(incident_id)
    return incident


def _require_active_user(user_id: str):
    user = query_one(
        "SELECT is_active FROM users WHERE id = %s", (user_id,)
    )
    if not user or not user["is_active"]:
        raise HTTPException(
            status_code=400,
            detail="Cannot assign incident to an inactive user",
        )


def create_incident(data, current_user: dict):
    role = current_user["role"]
    user_id = current_user["id"]

    assigned_to = data.assigned_to
    if role == "operator":
        if assigned_to is not None:
            raise HTTPException(status_code=403, detail="Operator cannot assign incidents")
        assigned_to = None
    elif assigned_to is not None:
        _require_active_user(assigned_to)

    incident = repo.insert_incident(
        data.title, data.description, data.severity_id,
        data.location, assigned_to, user_id,
    )

    create_audit_log(
        user_id, "CREATE", "incident", incident["id"], None,
        {"title": data.title, "severity_id": data.severity_id, "assigned_to": assigned_to},
    )

    return {"message": "Incident created", "id": incident["id"]}


def update_incident(incident_id: str, data, current_user: dict):
    role = current_user["role"]
    user_id = current_user["id"]

    existing = repo.find_incident_basic(incident_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Incident not found")

    if role == "operator" and str(existing["assigned_to"]) != user_id:
        raise HTTPException(status_code=403, detail="You can only update incidents assigned to you")

    updates = {}
    if data.title is not None:
        updates["title"] = data.title
    if data.description is not None:
        updates["description"] = data.description
    if data.severity_id is not None:
        updates["severity_id"] = data.severity_id
    if data.status_id is not None and data.status_id != existing["status_id"]:
        validate_status_transition(existing["status_id"], data.status_id, role)
        updates["status_id"] = data.status_id
        if data.status_id in (STATUS_RESOLVED, STATUS_CLOSED):
            updates["is_resolved"] = True
            updates["resolved_at"] = datetime.now(timezone.utc)
    if data.location is not None:
        updates["location"] = data.location
    if data.assigned_to is not None:
        if not is_admin_role(role):
            raise HTTPException(status_code=403, detail="Only admin can reassign incidents")
        if data.assigned_to:
            _require_active_user(data.assigned_to)
            updates["assigned_to"] = data.assigned_to
        else:
            updates["assigned_to"] = None

    if role == "operator":
        allowed = {"status_id", "is_resolved", "resolved_at"}
        updates = {k: v for k, v in updates.items() if k in allowed}

    if not updates and not data.comment:
        raise HTTPException(status_code=400, detail="No fields to update")

    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        repo.update_incident_fields(incident_id, updates)

    audit_changes = dict(updates) if updates else {}
    if data.comment:
        repo.insert_comment(incident_id, user_id, data.comment)
        audit_changes["comment"] = data.comment

    create_audit_log(user_id, "UPDATE", "incident", incident_id, dict(existing), audit_changes)
    return {"message": "Incident updated"}


def delete_incident(incident_id: str, current_user: dict):
    role = current_user["role"]
    user_id = current_user["id"]

    existing = repo.find_incident_basic(incident_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Incident not found")

    if not is_admin_role(role):
        raise HTTPException(status_code=403, detail="Only admin can delete incidents")

    repo.soft_delete_incident(incident_id, datetime.now(timezone.utc))
    create_audit_log(user_id, "DELETE", "incident", incident_id, dict(existing), None)
    return {"message": "Incident deleted"}


def delete_comment(incident_id: str, comment_id: str, current_user: dict):
    comment = repo.find_comment(comment_id)
    if not comment or str(comment["incident_id"]) != incident_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    repo.delete_comment(comment_id)
    create_audit_log(
        current_user["id"], "DELETE", "comment", comment_id,
        dict(comment), None,
    )
    return {"message": "Comment deleted"}
