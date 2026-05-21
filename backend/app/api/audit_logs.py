from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from ..db.database import query_all, query_one
from ..utils.auth import get_current_user, require_role

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])

@router.get("")
def list_audit_logs(
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_role(["admin"]))
):
    """List audit logs with optional filters by user, action, or entity type. Admin only."""
    offset = (page - 1) * limit
    conditions = []
    params = []

    if user_id:
        conditions.append("a.user_id = %s")
        params.append(user_id)
    if action:
        conditions.append("a.action = %s")
        params.append(action)
    if entity_type:
        conditions.append("a.entity_type = %s")
        params.append(entity_type)

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    total = query_one(f"""
        SELECT COUNT(*) as count FROM audit_logs a
        WHERE {where_clause}
    """, tuple(params))

    logs = query_all(f"""
        SELECT a.*, u.username
        FROM audit_logs a
        JOIN users u ON a.user_id = u.id
        WHERE {where_clause}
        ORDER BY a.created_at DESC
        LIMIT %s OFFSET %s
    """, tuple(params) + (limit, offset))

    return {
        "total": total["count"],
        "page": page,
        "limit": limit,
        "data": logs,
    }

@router.get("/users")
def get_audit_users(current_user: dict = Depends(require_role(["admin"]))):
    """Return distinct users who have audit log entries. Admin only."""
    users = query_all("""
        SELECT DISTINCT u.id, u.username, u.full_name
        FROM audit_logs a
        JOIN users u ON a.user_id = u.id
        ORDER BY u.username
    """)
    return users
