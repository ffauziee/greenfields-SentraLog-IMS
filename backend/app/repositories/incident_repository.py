import psycopg2.extras

from ..core.constants import STATUS_ACTIVE
from ..db.database import execute, get_pool, query_all, query_one
from ..core.config import get_settings

settings = get_settings()
EXPORT_ROW_LIMIT = 100_000

INCIDENT_COLS = "i.id, i.title, i.severity_id, i.status_id, i.location, i.assigned_to, i.reported_by, i.is_resolved, i.created_at, i.updated_at"

INCIDENT_LIST_JOIN = """FROM incidents i
JOIN severity_levels s ON i.severity_id = s.id
JOIN incident_statuses st ON i.status_id = st.id
JOIN users u ON i.reported_by = u.id
LEFT JOIN users a ON i.assigned_to = a.id"""

INCIDENT_LIST_SELECT = f"""SELECT {INCIDENT_COLS}, s.name as severity_name, s.color as severity_color,
s.level as severity_level, st.name as status_name,
u.username as reported_by_name, a.username as assigned_to_name"""

INCIDENT_LIST_SELECT_WITH_COUNT = f"""SELECT {INCIDENT_COLS}, s.name as severity_name, s.color as severity_color,
s.level as severity_level, st.name as status_name,
u.username as reported_by_name, a.username as assigned_to_name,
COUNT(*) OVER() as _total_count"""


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
    severities = query_all("SELECT id, sla_hours FROM severity_levels")
    if not severities:
        return {"count": 0}
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    conditions = []
    params = []
    for sev in severities:
        deadline = now - timedelta(hours=sev["sla_hours"])
        conditions.append("(i.severity_id = %s AND i.created_at < %s)")
        params.extend([sev["id"], deadline])
    where = " OR ".join(conditions)
    return query_one(
        f"""SELECT COUNT(*) as count FROM incidents i
            WHERE i.is_deleted = FALSE AND i.status_id IN %s
              AND ({where})""",
        (STATUS_ACTIVE, *params),
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
        f"""{INCIDENT_LIST_SELECT_WITH_COUNT}
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
            ORDER BY s.level DESC, i.created_at DESC
            LIMIT {EXPORT_ROW_LIMIT}""",
        params,
    )


def stream_all_incidents(where_clause: str, params: tuple):
    """Generator that streams incident rows via server-side cursor.
    Connection stays open until generator is exhausted or closed."""
    conn = get_pool().getconn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SET statement_timeout = 300000")
            cur.execute(
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
            while True:
                rows = cur.fetchmany(2000)
                if not rows:
                    break
                yield from rows
        conn.commit()
    except GeneratorExit:
        conn.rollback()
        raise
    finally:
        get_pool().putconn(conn)


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


def insert_comment(incident_id: str, user_id: str, content: str):
    return query_one(
        """INSERT INTO incident_comments (incident_id, user_id, content)
           VALUES (%s, %s, %s) RETURNING id""",
        (incident_id, user_id, content),
    )


def find_comment(comment_id: str):
    return query_one(
        """SELECT id, incident_id, user_id, content, created_at
           FROM incident_comments WHERE id = %s""",
        (comment_id,),
    )


def delete_comment(comment_id: str):
    execute("DELETE FROM incident_comments WHERE id = %s", (comment_id,))


def soft_delete_incident(incident_id: str, deleted_at):
    execute(
        "UPDATE incidents SET is_deleted = TRUE, updated_at = %s WHERE id = %s",
        (deleted_at, incident_id),
    )
