from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from ..core.config import get_settings
from ..db.database import query_one

security = HTTPBearer()
settings = get_settings()


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Check a plain-text password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict) -> str:
    """Create a signed JWT containing the given payload claims."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT, returning the payload. Raises 401 on failure."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Resolve the current authenticated user from the Bearer token."""
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = query_one(
        "SELECT id, username, full_name, role, is_active FROM users WHERE id = %s",
        (user_id,),
    )
    if not user or not user["is_active"]:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require_role(allowed_roles: list):
    """Return a dependency that restricts access to users with one of the given roles.

    The superadmin role inherits admin permissions so existing admin-only endpoints
    remain accessible after migrating the bootstrap admin account to superadmin.
    """
    effective_roles = set(allowed_roles)
    if "admin" in effective_roles:
        effective_roles.add("superadmin")

    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in effective_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of these roles: {', '.join(sorted(effective_roles))}",
            )
        return current_user

    return role_checker
