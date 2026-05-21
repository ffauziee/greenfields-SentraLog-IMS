from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from ..db.database import query_all, query_one, execute
from ..schemas.incident import IncidentCreate, IncidentUpdate
from ..utils.auth import get_current_user
from ..services.audit import create_audit_log
from ..services.attention import calculate_attention_score
from datetime import datetime, timezone
router = APIRouter(prefix="/api/incidents", tags=["incidents"])
@router.get("/dashboard")
def get_dashboard(user_id: str = Depends(get_current_user)):
    total_open = query_one("""
        SELECT COUNT(*) as count FROM incidents
        WHERE is_deleted = FALSE AND status_id IN (1, 2)
    """)
    critical = query_one("""
        SELECT COUNT(*) as count FROM incidents i
        JOIN severity_levels s ON i.severity_id = s.id
        WHERE i.is_deleted = FALSE AND s.name = 'CRITICAL' AND i.status_id IN (1, 2)
    """)
    past_sla = query_all("""
        SELECT i.*, s.name as severity_name, s.color as severity_color, s.level as severity_level,
               s.sla_hours, u.username as reported_by_name
        FROM incidents i
        JOIN severity_levels s ON i.severity_id = s.id
        JOIN users u ON i.reported_by = u.id
        WHERE i.is_deleted = FALSE AND i.status_id IN (1, 2)
          AND i.created_at < NOW() - (s.sla_hours || ' hours')::INTERVAL
        ORDER BY s.level DESC, i.created_at ASC
    """)
    recent = query_all("""
        SELECT i.id, i.title, s.name as severity_name, s.color as severity_color,
               s.level as severity_level, st.name as status_name,
               u.username as reported_by_name, i.created_at
        FROM incidents i
        JOIN severity_levels s ON i.severity_id = s.id
        JOIN incident_statuses st ON i.status_id = st.id
        JOIN users u ON i.reported_by = u.id
        WHERE i.is_deleted = FALSE
        ORDER BY s.level DESC, i.created_at DESC
        LIMIT 10
    """)
    attention = query_all("""
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
        WHERE i.is_deleted = FALSE
        ORDER BY
            CASE WHEN st.name IN ('OPEN', 'ESCALATED') THEN 0 ELSE 1 END,
            s.level DESC,
            CASE WHEN i.created_at < NOW() - (s.sla_hours || ' hours')::INTERVAL THEN 0 ELSE 1 END,
            i.created_at ASC
    """)
    for inc in attention:
        inc["attention_score"] = calculate_attention_score(inc, inc.get("age_hours", 0))
    return {
        "total_open": total_open["count"],
        "critical_count": critical["count"],
        "past_sla": past_sla,
        "recent": recent,
        "attention_incidents": attention
    }
@router.get("")
def list_incidents(
    search: Optional[str] = Query(None),
    severity: Optional[int] = Query(None),
    status: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user)
):
    offset = (page - 1) * limit
    where = ["i.is_deleted = FALSE"]
    params = []
    if search:
        where.append("(i.title ILIKE %s OR i.description ILIKE %s)")
        params.extend([f"%{search}%", f"%{search}%"])
    if severity:
        where.append("i.severity_id = %s")
        params.append(severity)
    if status:
        where.append("i.status_id = %s")
        params.append(status)
    where_clause = " AND ".join(where)
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
        "data": incidents
    }
@router.get("/{incident_id}")
def get_incident(incident_id: str, user_id: str = Depends(get_current_user)):
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
def create_incident(data: IncidentCreate, user_id: str = Depends(get_current_user)):
    incident = query_one("""
        INSERT INTO incidents (title, description, severity_id, location, assigned_to, reported_by)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (data.title, data.description, data.severity_id, data.location, data.assigned_to, user_id))
    create_audit_log(user_id, "CREATE", "incident", incident["id"],
                     None, {"title": data.title, "severity_id": data.severity_id})
    return {"message": "Incident created", "id": incident["id"]}
@router.put("/{incident_id}")
def update_incident(incident_id: str, data: IncidentUpdate, user_id: str = Depends(get_current_user)):
    existing = query_one("SELECT * FROM incidents WHERE id = %s AND is_deleted = FALSE", (incident_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Incident not found")
    updates = {}
    if data.title is not None: updates["title"] = data.title
    if data.description is not None: updates["description"] = data.description
    if data.severity_id is not None: updates["severity_id"] = data.severity_id
    if data.status_id is not None: updates["status_id"] = data.status_id
    if data.location is not None: updates["location"] = data.location
    if data.assigned_to is not None: updates["assigned_to"] = data.assigned_to
    if data.status_id in (3, 4):
        updates["is_resolved"] = True
        updates["resolved_at"] = datetime.now(timezone.utc)
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
def delete_incident(incident_id: str, user_id: str = Depends(get_current_user)):
    existing = query_one("SELECT * FROM incidents WHERE id = %s AND is_deleted = FALSE", (incident_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Incident not found")
    execute("UPDATE incidents SET is_deleted = TRUE, updated_at = %s WHERE id = %s",
            (datetime.now(timezone.utc), incident_id))
    create_audit_log(user_id, "DELETE", "incident", incident_id, dict(existing), None)
    return {"message": "Incident deleted"}