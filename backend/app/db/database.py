from contextlib import contextmanager

import psycopg2
import psycopg2.extras
import psycopg2.pool

from ..core.config import get_settings

settings = get_settings()

_pool = None


def get_pool():
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=settings.DB_POOL_MIN,
            maxconn=settings.DB_POOL_MAX,
            dsn=settings.DATABASE_URL,
        )
    return _pool


@contextmanager
def get_db():
    conn = get_pool().getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        get_pool().putconn(conn)


def _set_timeout(cur):
    cur.execute("SET statement_timeout = %s", (settings.DB_STATEMENT_TIMEOUT_MS,))


def query_all(sql: str, params: tuple = None):
    """Execute a SELECT query and return all matching rows as dicts."""
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _set_timeout(cur)
            cur.execute(sql, params)
            return cur.fetchall()


def query_one(sql: str, params: tuple = None):
    """Execute a SELECT query and return the first matching row as a dict."""
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _set_timeout(cur)
            cur.execute(sql, params)
            return cur.fetchone()


def execute(sql: str, params: tuple = None):
    """Execute an INSERT/UPDATE/DELETE query and return the number of affected rows."""
    with get_db() as conn:
        with conn.cursor() as cur:
            _set_timeout(cur)
            cur.execute(sql, params)
            return cur.rowcount


def check_db():
    """Ping the database by running SELECT 1. Returns True if reachable."""
    try:
        conn = get_pool().getconn()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        get_pool().putconn(conn)
        return True
    except Exception:
        return False


def close_pool():
    """Close all connections in the connection pool."""
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None
