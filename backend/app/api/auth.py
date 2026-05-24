from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..core.config import get_settings
from ..db.database import execute, query_one
from ..schemas.incident import LoginRequest, TokenResponse
from ..services.audit import create_audit_log
from ..utils.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest):
    """Authenticate a user by username and password, returning a JWT token."""
    user = query_one(
        "SELECT id, username, password_hash, role, full_name FROM users WHERE username = %s AND is_active = TRUE", (data.username,)
    )
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user["id"]), "role": user["role"]})
    return TokenResponse(
        access_token=token,
        role=user["role"],
        full_name=user["full_name"],
        user_id=str(user["id"]),
    )


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    old_password: Optional[str] = None
    new_password: Optional[str] = Field(None, min_length=6)


@router.put("/me")
def update_profile(
    data: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update own profile: full_name and/or password."""
    if data.full_name is None and data.new_password is None:
        raise HTTPException(status_code=400, detail="Nothing to update")

    updates = {}
    if data.full_name is not None:
        updates["full_name"] = data.full_name

    if data.new_password is not None:
        if not data.old_password:
            raise HTTPException(status_code=400, detail="Old password is required")
        stored = query_one(
            "SELECT password_hash FROM users WHERE id = %s",
            (current_user["id"],),
        )
        if not stored or not verify_password(data.old_password, stored["password_hash"]):
            raise HTTPException(status_code=400, detail="Old password is incorrect")
        updates["password_hash"] = hash_password(data.new_password)

    set_clause = ", ".join([f"{k} = %s" for k in updates.keys()])
    values = list(updates.values()) + [current_user["id"]]
    execute(
        f"UPDATE users SET {set_clause}, updated_at = NOW() WHERE id = %s",
        tuple(values),
    )
    create_audit_log(
        current_user["id"], "UPDATE", "user", current_user["id"], None, updates
    )
    return {
        "id": str(current_user["id"]),
        "username": current_user["username"],
        "full_name": updates.get("full_name", current_user["full_name"]),
        "role": current_user["role"],
    }


@router.post("/seed")
def seed_users():
    """Insert default admin and operator accounts if they do not already exist."""
    if settings.ENVIRONMENT.lower() == "production":
        raise HTTPException(
            status_code=403, detail="Seed endpoint is disabled in production"
        )

    created = []

    admin = query_one("SELECT id FROM users WHERE username = 'admin'")
    if not admin:
        execute(
            """
            INSERT INTO users (username, email, password_hash, full_name, role)
            VALUES (%s, %s, %s, %s, %s)
        """,
            (
                "admin",
                "admin@greenfields.com",
                hash_password("admin123"),
                "System Superadmin",
                "superadmin",
            ),
        )
        created.append("superadmin (admin/admin123)")

    operators = [
        ("operator_a", "Operator Tangki A", "operator"),
        ("operator_b", "Operator Tangki B", "operator"),
        ("operator_c", "Operator Tangki C", "operator"),
    ]
    for username, full_name, role in operators:
        existing = query_one("SELECT id FROM users WHERE username = %s", (username,))
        if not existing:
            execute(
                """
                INSERT INTO users (username, email, password_hash, full_name, role)
                VALUES (%s, %s, %s, %s, %s)
            """,
                (
                    username,
                    f"{username}@greenfields.com",
                    hash_password("operator123"),
                    full_name,
                    role,
                ),
            )
            created.append(f"{full_name} ({username}/operator123)")

    if not created:
        return {"message": "All users already exist"}
    return {"message": f"Created: {', '.join(created)}"}
