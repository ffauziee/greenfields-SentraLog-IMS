from fastapi import APIRouter, HTTPException
from ..db.database import query_one, execute
from ..schemas.incident import LoginRequest, TokenResponse
from ..utils.auth import hash_password, verify_password, create_access_token
router = APIRouter(prefix="/api/auth", tags=["auth"])
@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest):
    user = query_one("SELECT * FROM users WHERE username = %s AND is_active = TRUE", (data.username,))
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user["id"]), "role": user["role"]})
    return TokenResponse(
        access_token=token,
        role=user["role"],
        full_name=user["full_name"],
        user_id=str(user["id"])
    )
@router.post("/seed")
def seed_admin():
    existing = query_one("SELECT id FROM users WHERE username = 'admin'")
    if existing:
        return {"message": "Admin user already exists"}
    execute("""
        INSERT INTO users (username, email, password_hash, full_name, role)
        VALUES (%s, %s, %s, %s, %s)
    """, ("admin", "admin@greenfields.com", hash_password("admin123"), "System Admin", "admin"))
    return {"message": "Admin user created. Username: admin, Password: admin123"}