import json
from datetime import datetime, timezone
from ..db.database import execute

def to_json(value):
    if value is None:
        return None
    return json.dumps(value, default=str)

def create_audit_log(user_id: str, action: str, entity_type: str,
                     entity_id: str, old_value: dict = None, new_value: dict = None,
                     description: str = None, ip_address: str = None):
    execute("""
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, description, ip_address)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (user_id, action, entity_type, entity_id,
          to_json(old_value),
          to_json(new_value),
          description, ip_address))