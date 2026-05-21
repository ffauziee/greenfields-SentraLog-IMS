from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
class IncidentCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    severity_id: int = Field(..., ge=1, le=4)
    location: Optional[str] = None
    assigned_to: Optional[str] = None
class IncidentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = None
    severity_id: Optional[int] = Field(None, ge=1, le=4)
    status_id: Optional[int] = Field(None, ge=1, le=5)
    location: Optional[str] = None
    assigned_to: Optional[str] = None
class IncidentResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    severity_id: int
    severity_name: str
    severity_color: str
    severity_level: int
    status_id: int
    status_name: str
    reported_by: str
    reported_by_name: str
    assigned_to: Optional[str]
    assigned_to_name: Optional[str]
    location: Optional[str]
    is_resolved: bool
    is_deleted: bool
    resolved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
class LoginRequest(BaseModel):
    username: str
    password: str
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str
    user_id: str