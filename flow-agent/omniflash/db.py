"""Postgres (Neon) metadata store for generated media.

Stores ONLY metadata (type, prompt, url, media_id, r2_key, created_at) — never the
binary, which lives in R2. This powers the gallery/history and survives Hugging
Face Space restarts. Reuses the same Neon DB as the browser-agent's profilesync
(different table: `media` vs `chrome_profile`).

Enabled when DATABASE_URL is set; otherwise `is_enabled()` returns False and the
API falls back to the on-disk history.json. psycopg is imported lazily so this
module imports fine without the dependency installed (until enabled).
"""

import logging
import os
import threading

log = logging.getLogger("omniflash.db")

DATABASE_URL = os.environ.get("DATABASE_URL", "")

_lock = threading.Lock()
_initialized = False


def is_enabled() -> bool:
    return bool(DATABASE_URL)


def _connect():
    import psycopg
    return psycopg.connect(DATABASE_URL, connect_timeout=15)


def init() -> None:
    """Create the media table once. Blocking — wrap in asyncio.to_thread."""
    global _initialized
    if not is_enabled() or _initialized:
        return
    with _lock:
        if _initialized:
            return
        with _connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS media (
                    id         bigserial PRIMARY KEY,
                    media_id   text,
                    type       text NOT NULL,
                    prompt     text,
                    url        text NOT NULL,
                    r2_key     text,
                    created_at timestamptz NOT NULL DEFAULT now()
                )
                """
            )
            conn.commit()
        _initialized = True
        log.info("🗄️  media table ready")


def insert(type_str: str, url: str, prompt: str, media_id=None, r2_key=None) -> None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO media (media_id, type, prompt, url, r2_key) "
            "VALUES (%s, %s, %s, %s, %s)",
            (media_id, type_str, prompt, url, r2_key),
        )
        conn.commit()


def list_media(limit: int = 100) -> list[dict]:
    """Return newest-first entries shaped like the legacy history.json items."""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT type, url, prompt, media_id, r2_key, "
            "       extract(epoch FROM created_at)::bigint "
            "FROM media ORDER BY created_at DESC, id DESC LIMIT %s",
            (limit,),
        )
        rows = cur.fetchall()
    return [
        {
            "type": r[0], "url": r[1], "prompt": r[2],
            "media_id": r[3], "r2_key": r[4], "timestamp": r[5],
        }
        for r in rows
    ]


def delete_all() -> list[str]:
    """Delete every row; return the r2_keys removed (for object cleanup)."""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT r2_key FROM media WHERE r2_key IS NOT NULL")
        keys = [r[0] for r in cur.fetchall()]
        cur.execute("DELETE FROM media")
        conn.commit()
    return keys


def delete_by_url(url_substr: str) -> list[str]:
    """Delete rows whose url contains `url_substr`; return removed r2_keys."""
    like = f"%{url_substr}%"
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT r2_key FROM media WHERE url LIKE %s AND r2_key IS NOT NULL",
            (like,),
        )
        keys = [r[0] for r in cur.fetchall()]
        cur.execute("DELETE FROM media WHERE url LIKE %s", (like,))
        conn.commit()
    return keys
