import json
from typing import Any

from ..db.database import execute


def to_json(value: Any):
    if value is None:
        return None
    return json.dumps(value, default=str)


def create_audit_log(
    user_id: Any,
    action: str,
    entity_type: str,
    entity_id: Any,
    old_value: dict[str, Any] | None = None,
    new_value: dict[str, Any] | None = None,
    description: str | None = None,
    ip_address: str | None = None,
):
    """Insert a row into audit_logs recording who did what to which entity."""
    execute(
        """
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, description, ip_address)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """,
        (
            user_id,
            action,
            entity_type,
            entity_id,
            to_json(old_value),
            to_json(new_value),
            description,
            ip_address,
        ),
    )
