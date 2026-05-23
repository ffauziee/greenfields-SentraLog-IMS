from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..core.config import get_settings
from ..db.database import execute, query_all, query_one
from ..services.audit import create_audit_log
from ..utils.auth import hash_password, require_role

router = APIRouter(prefix="/api/users", tags=["users"])
settings = get_settings()


def is_superadmin(user: dict) -> bool:
    return (
        user.get("username") == settings.SUPERADMIN_USERNAME
        and user.get("role") == "superadmin"
    )


def active_admin_count() -> int:
    result = query_one(
        "SELECT COUNT(*) as count FROM users WHERE role IN ('superadmin', 'admin') AND is_active = TRUE"
    )
    return int(result["count"] if result else 0)


def can_manage_superadmin(current_user: dict) -> bool:
    return current_user.get("role") == "superadmin"


def ensure_admin_account_safety(
    existing: dict, updates: dict | None = None, deleting: bool = False
):
    """Prevent removing the protected superadmin or the last active admin account."""
    updates = updates or {}
    will_deactivate = deleting or updates.get("is_active") is False
    will_demote = "role" in updates and updates["role"] not in ("superadmin", "admin")

    if is_superadmin(existing) and (will_deactivate or will_demote):
        raise HTTPException(
            status_code=400,
            detail="Protected superadmin account cannot be deactivated, deleted, or demoted",
        )

    removes_active_admin = (
        existing.get("role") in ("superadmin", "admin")
        and existing.get("is_active")
        and (will_deactivate or will_demote)
    )
    if removes_active_admin and active_admin_count() <= 1:
        raise HTTPException(
            status_code=400,
            detail="At least one active admin account must remain",
        )


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(..., pattern="^(superadmin|admin|operator)$")


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    role: Optional[str] = Field(None, pattern="^(superadmin|admin|operator)$")
    is_active: Optional[bool] = None


class PasswordReset(BaseModel):
    password: str = Field(..., min_length=6)


@router.get("")
def list_users(
    role: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(["admin"])),
):
    """List all users, optionally filtered by role. Admin only."""
    if role:
        users = query_all(
            """SELECT id, username, full_name, role, is_active, created_at
               FROM users WHERE role = %s AND is_active = TRUE ORDER BY full_name""",
            (role,),
        )
    else:
        users = query_all(
            """SELECT id, username, full_name, role, is_active, created_at
               FROM users ORDER BY role, full_name"""
        )
    return [dict(u, is_active=bool(u["is_active"])) for u in users]


@router.post("")
def create_user(
    data: UserCreate, current_user: dict = Depends(require_role(["admin"]))
):
    """Create a new user. Admin only."""
    existing = query_one("SELECT id FROM users WHERE username = %s", (data.username,))
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    if data.role == "superadmin" and not can_manage_superadmin(current_user):
        raise HTTPException(
            status_code=403, detail="Only superadmin can create another superadmin"
        )

    email = f"{data.username}@greenfields.com"
    user = query_one(
        """
        INSERT INTO users (username, email, password_hash, full_name, role)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, username, full_name, role
    """,
        (data.username, email, hash_password(data.password), data.full_name, data.role),
    )
    create_audit_log(
        current_user["id"],
        "CREATE",
        "user",
        user["id"],
        None,
        {
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
        },
    )
    return user


@router.put("/{user_id}")
def update_user(
    user_id: str,
    data: UserUpdate,
    current_user: dict = Depends(require_role(["admin"])),
):
    """Update a user's full_name, role, or active status. Admin only."""
    existing = query_one(
        "SELECT id, username, full_name, role, is_active FROM users WHERE id = %s",
        (user_id,),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {}
    if data.full_name is not None:
        updates["full_name"] = data.full_name
    if data.role is not None:
        if data.role == "superadmin" and not can_manage_superadmin(current_user):
            raise HTTPException(
                status_code=403, detail="Only superadmin can assign superadmin role"
            )
        updates["role"] = data.role
    if data.is_active is not None:
        updates["is_active"] = data.is_active

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    ensure_admin_account_safety(existing, updates)

    set_clause = ", ".join([f"{k} = %s" for k in updates.keys()])
    values = list(updates.values()) + [user_id]
    execute(
        f"UPDATE users SET {set_clause}, updated_at = NOW() WHERE id = %s",
        tuple(values),
    )
    create_audit_log(
        current_user["id"], "UPDATE", "user", user_id, dict(existing), updates
    )
    return {"message": "User updated"}


@router.put("/{user_id}/reset-password")
def reset_password(
    user_id: str,
    data: PasswordReset,
    current_user: dict = Depends(require_role(["admin"])),
):
    """Reset a user's password. Admin only."""
    existing = query_one(
        "SELECT id, username FROM users WHERE id = %s",
        (user_id,),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    execute(
        "UPDATE users SET password_hash = %s, updated_at = NOW() WHERE id = %s",
        (hash_password(data.password), user_id),
    )
    create_audit_log(
        current_user["id"],
        "UPDATE",
        "user",
        user_id,
        {"username": existing["username"]},
        {"password_reset": True},
    )
    return {"message": "Password reset successfully"}


@router.delete("/{user_id}")
def delete_user(user_id: str, current_user: dict = Depends(require_role(["admin"]))):
    """Delete or deactivate a user. Admin only. Deactivates if any records reference the user."""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    existing = query_one(
        "SELECT id, username, full_name, role, is_active FROM users WHERE id = %s",
        (user_id,),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    ensure_admin_account_safety(existing, deleting=True)

    refs = query_one(
        """
        SELECT
          COALESCE((SELECT COUNT(*) FROM incidents WHERE assigned_to = %s), 0)
          + COALESCE((SELECT COUNT(*) FROM incidents WHERE reported_by = %s), 0)
          + COALESCE((SELECT COUNT(*) FROM incident_comments WHERE user_id = %s), 0)
          AS count
        """,
        (user_id, user_id, user_id),
    )
    if refs["count"] > 0:
        execute(
            "UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = %s",
            (user_id,),
        )
        create_audit_log(
            current_user["id"],
            "UPDATE",
            "user",
            user_id,
            dict(existing),
            {"is_active": False, "reason": f"user has {refs['count']} related records"},
        )
        return {
            "message": f"User deactivated (has {refs['count']} related incidents/comments)"
        }

    execute("DELETE FROM users WHERE id = %s", (user_id,))
    create_audit_log(
        current_user["id"], "DELETE", "user", user_id, dict(existing), None
    )
    return {"message": "User deleted"}
