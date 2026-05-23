from ..core.constants import STATUS_ACTIVE
from ..db.database import execute, query_all, query_one
from ..core.config import get_settings

settings = get_settings()

INCIDENT_COLS = "i.id, i.title, i.severity_id, i.status_id, i.location, i.assigned_to, i.reported_by, i.is_resolved, i.created_at, i.updated_at"

INCIDENT_LIST_JOIN = """FROM incidents i
JOIN severity_levels s ON i.severity_id = s.id
JOIN incident_statuses st ON i.status_id = st.id
JOIN users u ON i.reported_by = u.id
LEFT JOIN users a ON i.assigned_to = a.id"""

INCIDENT_LIST_SELECT = f"""SELECT {INCIDENT_COLS}, s.name as severity_name, s.color as severity_color,
s.level as severity_level, st.name as status_name,
u.username as reported_by_name, a.username as assigned_to_name"""


def get_dashboard_counts():
    return query_one(
        """SELECT
               COUNT(*) as total_open,
               COUNT(*) FILTER (WHERE s.name = 'CRITICAL') as critical_count,
               COUNT(*) FILTER (WHERE i.assigned_to IS NULL) as unassigned_count
           FROM incidents i
           JOIN severity_levels s ON i.severity_id = s.id
           WHERE i.is_deleted = FALSE AND i.status_id IN %s""",
        (STATUS_ACTIVE,),
    )


def get_past_sla_count():
    return query_one(
        """SELECT COUNT(*) as count FROM incidents i
           JOIN severity_levels s ON i.severity_id = s.id
           WHERE i.is_deleted = FALSE AND i.status_id IN %s
             AND i.created_at < NOW() - (s.sla_hours || ' hours')::INTERVAL""",
        (STATUS_ACTIVE,),
    )


def get_recent_incidents():
    return query_all(
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
        (STATUS_ACTIVE,),
    )


def get_attention_incidents(limit: int):
    return query_all(
        f"""SELECT {INCIDENT_COLS}, s.name as severity_name, s.color as severity_color,
                   s.level as severity_level, s.sla_hours,
                   st.name as status_name,
                   u.username as reported_by_name,
                   a.username as assigned_to_name,
                   EXTRACT(EPOCH FROM (NOW() - i.created_at))/3600 as age_hours
            {INCIDENT_LIST_JOIN}
            WHERE i.is_deleted = FALSE AND i.status_id IN %s
            ORDER BY
                CASE WHEN st.name IN ('OPEN', 'ESCALATED') THEN 0 ELSE 1 END,
                s.level DESC,
                CASE WHEN i.created_at < NOW() - (s.sla_hours || ' hours')::INTERVAL THEN 0 ELSE 1 END,
                i.created_at ASC
            LIMIT %s""",
        (STATUS_ACTIVE, limit),
    )


def count_incidents(where_clause: str, params: tuple):
    return query_one(
        f"SELECT COUNT(*) as count FROM incidents i WHERE {where_clause}", params
    )


def find_incidents(where_clause: str, params: tuple, limit: int, offset: int):
    return query_all(
        f"""{INCIDENT_LIST_SELECT}
        {INCIDENT_LIST_JOIN}
        WHERE {where_clause}
        ORDER BY s.level DESC, i.created_at DESC
        LIMIT %s OFFSET %s""",
        params + (limit, offset),
    )


def find_all_incidents(where_clause: str, params: tuple):
    return query_all(
        f"""SELECT {INCIDENT_COLS}, s.name as severity_name, s.color as severity_color,
                   s.level as severity_level, s.sla_hours,
                   st.name as status_name,
                   u.username as reported_by_name,
                   a.username as assigned_to_name
            {INCIDENT_LIST_JOIN}
            WHERE {where_clause}
            ORDER BY s.level DESC, i.created_at DESC""",
        params,
    )


def find_incident_by_id(incident_id: str):
    return query_one(
        f"""SELECT {INCIDENT_COLS}, i.description, i.resolved_at,
                   s.name as severity_name, s.color as severity_color,
                   s.level as severity_level, s.sla_hours,
                   st.name as status_name,
                   u.username as reported_by_name,
                   a.username as assigned_to_name
            {INCIDENT_LIST_JOIN}
            WHERE i.id = %s AND i.is_deleted = FALSE""",
        (incident_id,),
    )


def get_incident_comments(incident_id: str):
    return query_all(
        """SELECT c.id, c.content, c.user_id, c.created_at, u.username
           FROM incident_comments c
           JOIN users u ON c.user_id = u.id
           WHERE c.incident_id = %s
           ORDER BY c.created_at DESC""",
        (incident_id,),
    )


def find_incident_basic(incident_id: str):
    return query_one(
        f"SELECT {INCIDENT_COLS} FROM incidents i WHERE i.id = %s AND i.is_deleted = FALSE",
        (incident_id,),
    )


def insert_incident(title, description, severity_id, location, assigned_to, reported_by):
    return query_one(
        """INSERT INTO incidents (title, description, severity_id, location, assigned_to, reported_by)
           VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
        (title, description, severity_id, location, assigned_to, reported_by),
    )


def update_incident_fields(incident_id: str, updates: dict):
    set_clause = ", ".join([f"{k} = %s" for k in updates.keys()])
    values = list(updates.values()) + [incident_id]
    execute(f"UPDATE incidents SET {set_clause} WHERE id = %s", tuple(values))


def soft_delete_incident(incident_id: str, deleted_at):
    execute(
        "UPDATE incidents SET is_deleted = TRUE, updated_at = %s WHERE id = %s",
        (deleted_at, incident_id),
    )
