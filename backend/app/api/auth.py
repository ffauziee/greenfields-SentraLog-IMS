from fastapi import APIRouter, HTTPException

from ..core.config import get_settings
from ..db.database import execute, query_one
from ..schemas.incident import LoginRequest, TokenResponse
from ..utils.auth import create_access_token, hash_password, verify_password

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
                    hash_password("operator"),
                    full_name,
                    role,
                ),
            )
            created.append(f"{full_name} ({username}/operator)")

    if not created:
        return {"message": "All users already exist"}
    return {"message": f"Created: {', '.join(created)}"}
