from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from ..db.database import query_all, query_one, execute
from ..schemas.incident import IncidentCreate, IncidentUpdate
from ..utils.auth import get_current_user, require_role
from ..services.audit import create_audit_log
from ..services.attention import calculate_attention_score
from datetime import datetime, timezone

router = APIRouter(prefix="/api/incidents", tags=["incidents"])

ALLOWED_OPERATOR_TRANSITIONS = {
    1: [2],       # OPEN -> IN_PROGRESS
    2: [3],       # IN_PROGRESS -> RESOLVED
    3: [],        # RESOLVED -> (nothing for operator)
    4: [],        # CLOSED -> (nothing)
    5: [],        # ESCALATED -> (nothing)
}

STATUS_ACTIVE = (1, 2, 5)   # OPEN, IN_PROGRESS, ESCALATED
STATUS_ARCHIVED = (3, 4)     # RESOLVED, CLOSED
STATUS_UNASSIGNED = (1, 2, 5)  # unassigned only applies to active statuses

def validate_status_transition(current_status_id: int, new_status_id: int, role: str):
    if role == "admin":
        return
    allowed = ALLOWED_OPERATOR_TRANSITIONS.get(current_status_id, [])
    if new_status_id not in allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Operator cannot change status from {current_status_id} to {new_status_id}. Allowed: {allowed}" if allowed
            else f"Operator cannot change status from current state (no transitions allowed)"
        )

def apply_role_filter(role: str, user_id: str, where_clause: str, params: list, for_unassigned: bool = False):
    if role == "operator":
        if for_unassigned:
            return "1=0", params  # operator never sees unassigned tab
        where_clause += " AND i.assigned_to = %s"
        params.append(user_id)
    return where_clause, params

@router.get("/dashboard")
def get_dashboard(current_user: dict = Depends(get_current_user)):
    role = current_user["role"]
    user_id = current_user["id"]

    base_active = "i.is_deleted = FALSE AND i.status_id IN %s"
    active_params = (STATUS_ACTIVE,)

    total_open = query_one(f"""
        SELECT COUNT(*) as count FROM incidents i
        WHERE {base_active}
    """, active_params)

    critical = query_one(f"""
        SELECT COUNT(*) as count FROM incidents i
        JOIN severity_levels s ON i.severity_id = s.id
        WHERE {base_active} AND s.name = 'CRITICAL'
    """, active_params)

    unassigned = query_one(f"""
        SELECT COUNT(*) as count FROM incidents i
        WHERE {base_active} AND i.assigned_to IS NULL
    """, active_params)

    past_sla_where = f"""
        i.is_deleted = FALSE AND i.status_id IN %s
        AND i.created_at < NOW() - (s.sla_hours || ' hours')::INTERVAL
    """
    past_sla_params = [STATUS_ACTIVE]
    past_sla_where, past_sla_params = apply_role_filter(role, user_id, past_sla_where, past_sla_params)
    past_sla = query_all(f"""
        SELECT i.*, s.name as severity_name, s.color as severity_color, s.level as severity_level,
               s.sla_hours, u.username as reported_by_name
        FROM incidents i
        JOIN severity_levels s ON i.severity_id = s.id
        JOIN users u ON i.reported_by = u.id
        WHERE {past_sla_where}
        ORDER BY s.level DESC, i.created_at ASC
    """, tuple(past_sla_params))

    recent_where = "i.is_deleted = FALSE AND i.status_id IN %s"
    recent_params = [STATUS_ACTIVE]
    recent_where, recent_params = apply_role_filter(role, user_id, recent_where, recent_params)
    recent = query_all(f"""
        SELECT i.id, i.title, i.assigned_to, s.name as severity_name, s.color as severity_color,
               s.level as severity_level, st.name as status_name,
               u.username as reported_by_name, i.created_at
        FROM incidents i
        JOIN severity_levels s ON i.severity_id = s.id
        JOIN incident_statuses st ON i.status_id = st.id
        JOIN users u ON i.reported_by = u.id
        WHERE {recent_where}
        ORDER BY s.level DESC, i.created_at DESC
        LIMIT 10
    """, tuple(recent_params))

    attention_where = "i.is_deleted = FALSE AND i.status_id IN %s"
    attention_params = [STATUS_ACTIVE]
    attention_where, attention_params = apply_role_filter(role, user_id, attention_where, attention_params)
    attention = query_all(f"""
        SELECT i.*, s.name as severity_name, s.color as severity_color,
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
        WHERE {attention_where}
        ORDER BY
            CASE WHEN st.name IN ('OPEN', 'ESCALATED') THEN 0 ELSE 1 END,
            s.level DESC,
            CASE WHEN i.created_at < NOW() - (s.sla_hours || ' hours')::INTERVAL THEN 0 ELSE 1 END,
            i.created_at ASC
    """, tuple(attention_params))

    for inc in attention:
        inc["attention_score"] = calculate_attention_score(inc, inc.get("age_hours", 0))

    return {
        "total_open": total_open["count"],
        "critical_count": critical["count"],
        "unassigned_count": unassigned["count"],
        "past_sla": past_sla,
        "recent": recent,
        "attention_incidents": attention,
        "role": role,
    }

@router.get("")
def list_incidents(
    search: Optional[str] = Query(None),
    severity: Optional[int] = Query(None),
    status: Optional[int] = Query(None),
    status_group: Optional[str] = Query("active"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    role = current_user["role"]
    user_id = current_user["id"]
    offset = (page - 1) * limit
    conditions = ["i.is_deleted = FALSE"]
    params = []

    if status_group == "archived":
        conditions.append("i.status_id IN %s")
        params.append(STATUS_ARCHIVED)
    elif status_group == "unassigned":
        if role != "admin":
            raise HTTPException(status_code=403, detail="Only admin can view unassigned incidents")
        conditions.append("i.status_id IN %s AND i.assigned_to IS NULL")
        params.append(STATUS_UNASSIGNED)
    else:
        conditions.append("i.status_id IN %s")
        params.append(STATUS_ACTIVE)
        if role == "operator":
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

    total = query_one(f"SELECT COUNT(*) as count FROM incidents i WHERE {where_clause}", tuple(params))
    incidents = query_all(f"""
        SELECT i.*, s.name as severity_name, s.color as severity_color,
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
    """, tuple(params) + (limit, offset))

    return {
        "total": total["count"],
        "page": page,
        "limit": limit,
        "data": incidents,
    }

@router.get("/{incident_id}")
def get_incident(incident_id: str, current_user: dict = Depends(get_current_user)):
    incident = query_one("""
        SELECT i.*, s.name as severity_name, s.color as severity_color,
               s.level as severity_level, s.sla_hours,
               st.name as status_name,
               u.username as reported_by_name,
               a.username as assigned_to_name
        FROM incidents i
        JOIN severity_levels s ON i.severity_id = s.id
        JOIN incident_statuses st ON i.status_id = st.id
        JOIN users u ON i.reported_by = u.id
        LEFT JOIN users a ON i.assigned_to = a.id
        WHERE i.id = %s AND i.is_deleted = FALSE
    """, (incident_id,))
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if current_user["role"] == "operator" and str(incident["assigned_to"]) != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only view incidents assigned to you")

    comments = query_all("""
        SELECT c.*, u.username as username
        FROM incident_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.incident_id = %s
        ORDER BY c.created_at DESC
    """, (incident_id,))
    incident["comments"] = comments
    return incident

@router.post("")
def create_incident(data: IncidentCreate, current_user: dict = Depends(get_current_user)):
    role = current_user["role"]
    user_id = current_user["id"]

    assigned_to = data.assigned_to
    if role == "operator":
        if assigned_to is not None:
            raise HTTPException(status_code=403, detail="Operator cannot assign incidents")
        assigned_to = None
    elif role == "admin" and assigned_to is None:
        pass

    incident = query_one("""
        INSERT INTO incidents (title, description, severity_id, location, assigned_to, reported_by)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (data.title, data.description, data.severity_id, data.location, assigned_to, user_id))

    create_audit_log(user_id, "CREATE", "incident", incident["id"],
                     None, {"title": data.title, "severity_id": data.severity_id, "assigned_to": assigned_to})
    return {"message": "Incident created", "id": incident["id"]}

@router.put("/{incident_id}")
def update_incident(incident_id: str, data: IncidentUpdate, current_user: dict = Depends(get_current_user)):
    role = current_user["role"]
    user_id = current_user["id"]

    existing = query_one("SELECT * FROM incidents WHERE id = %s AND is_deleted = FALSE", (incident_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Incident not found")

    if role == "operator" and str(existing["assigned_to"]) != user_id:
        raise HTTPException(status_code=403, detail="You can only update incidents assigned to you")

    updates = {}
    if data.title is not None: updates["title"] = data.title
    if data.description is not None: updates["description"] = data.description
    if data.severity_id is not None: updates["severity_id"] = data.severity_id
    if data.status_id is not None:
        validate_status_transition(existing["status_id"], data.status_id, role)
        updates["status_id"] = data.status_id
        if data.status_id in (3, 4):
            updates["is_resolved"] = True
            updates["resolved_at"] = datetime.now(timezone.utc)
    if data.location is not None: updates["location"] = data.location
    if data.assigned_to is not None:
        if role != "admin":
            raise HTTPException(status_code=403, detail="Only admin can reassign incidents")
        updates["assigned_to"] = data.assigned_to

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clause = ", ".join([f"{k} = %s" for k in updates.keys()])
    updates["updated_at"] = datetime.now(timezone.utc)
    set_clause += ", updated_at = %s"
    values = list(updates.values()) + [incident_id]
    execute(f"UPDATE incidents SET {set_clause} WHERE id = %s", tuple(values))
    create_audit_log(user_id, "UPDATE", "incident", incident_id, dict(existing), updates)
    return {"message": "Incident updated"}

@router.delete("/{incident_id}")
def delete_incident(incident_id: str, current_user: dict = Depends(get_current_user)):
    role = current_user["role"]
    user_id = current_user["id"]

    existing = query_one("SELECT * FROM incidents WHERE id = %s AND is_deleted = FALSE", (incident_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Incident not found")

    if role == "operator" and str(existing["assigned_to"]) != user_id:
        raise HTTPException(status_code=403, detail="You can only delete incidents assigned to you")

    execute("UPDATE incidents SET is_deleted = TRUE, updated_at = %s WHERE id = %s",
            (datetime.now(timezone.utc), incident_id))
    create_audit_log(user_id, "DELETE", "incident", incident_id, dict(existing), None)
    return {"message": "Incident deleted"}
