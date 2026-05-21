from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
from ..db.database import query_all, query_one, execute
from ..utils.auth import get_current_user, require_role, hash_password
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/users", tags=["users"])

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(..., pattern="^(admin|operator)$")

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    role: Optional[str] = Field(None, pattern="^(admin|operator)$")
    is_active: Optional[bool] = None

class PasswordReset(BaseModel):
    password: str = Field(..., min_length=6)

@router.get("")
def list_users(
    role: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(["admin"]))
):
    """List all users, optionally filtered by role. Admin only."""
    if role:
        users = query_all(
            """SELECT id, username, full_name, role, is_active, created_at
               FROM users WHERE role = %s ORDER BY full_name""",
            (role,)
        )
    else:
        users = query_all(
            """SELECT id, username, full_name, role, is_active, created_at
               FROM users ORDER BY role, full_name"""
        )
    return [dict(u, is_active=bool(u["is_active"])) for u in users]

@router.post("")
def create_user(data: UserCreate, current_user: dict = Depends(require_role(["admin"]))):
    """Create a new user. Admin only."""
    existing = query_one("SELECT id FROM users WHERE username = %s", (data.username,))
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    email = f"{data.username}@greenfields.com"
    user = query_one("""
        INSERT INTO users (username, email, password_hash, full_name, role)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, username, full_name, role
    """, (data.username, email, hash_password(data.password), data.full_name, data.role))
    return user

@router.put("/{user_id}")
def update_user(user_id: str, data: UserUpdate, current_user: dict = Depends(require_role(["admin"]))):
    """Update a user's full_name, role, or active status. Admin only."""
    existing = query_one("SELECT id FROM users WHERE id = %s", (user_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {}
    if data.full_name is not None: updates["full_name"] = data.full_name
    if data.role is not None: updates["role"] = data.role
    if data.is_active is not None: updates["is_active"] = data.is_active

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join([f"{k} = %s" for k in updates.keys()])
    values = list(updates.values()) + [user_id]
    execute(f"UPDATE users SET {set_clause} WHERE id = %s", tuple(values))
    return {"message": "User updated"}

@router.put("/{user_id}/reset-password")
def reset_password(user_id: str, data: PasswordReset, current_user: dict = Depends(require_role(["admin"]))):
    """Reset a user's password. Admin only."""
    existing = query_one("SELECT id FROM users WHERE id = %s", (user_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    execute("UPDATE users SET password_hash = %s WHERE id = %s",
            (hash_password(data.password), user_id))
    return {"message": "Password reset successfully"}

@router.delete("/{user_id}")
def delete_user(user_id: str, current_user: dict = Depends(require_role(["admin"]))):
    """Delete or deactivate a user. Admin only. Deactivates if user has active incidents."""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    existing = query_one("SELECT id FROM users WHERE id = %s", (user_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    incident_count = query_one(
        "SELECT COUNT(*) as count FROM incidents WHERE assigned_to = %s AND is_deleted = FALSE",
        (user_id,)
    )
    if incident_count["count"] > 0:
        execute("UPDATE users SET is_active = FALSE WHERE id = %s", (user_id,))
        return {"message": f"User deactivated (has {incident_count['count']} active incidents assigned)"}

    execute("DELETE FROM users WHERE id = %s", (user_id,))
    return {"message": "User deleted"}
