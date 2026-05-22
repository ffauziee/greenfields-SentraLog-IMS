from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import audit_logs, auth, incidents, users
from .core.config import get_settings
from .db.database import check_db, close_pool

settings = get_settings()
cors_origins = [
    origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    close_pool()


app = FastAPI(title=settings.APP_NAME, version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(incidents.router)
app.include_router(users.router)
app.include_router(audit_logs.router)


@app.get("/health")
def health_check():
    db_ok = check_db()
    return {
        "status": "healthy" if db_ok else "degraded",
        "app": settings.APP_NAME,
        "database": "connected" if db_ok else "disconnected",
    }
