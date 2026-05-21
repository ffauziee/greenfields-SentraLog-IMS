import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from ..core.config import get_settings
settings = get_settings()
def get_connection():
    return psycopg2.connect(settings.DATABASE_URL)
@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
def query_all(sql: str, params: tuple = None):
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchall()
def query_one(sql: str, params: tuple = None):
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchone()
def execute(sql: str, params: tuple = None):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.rowcount