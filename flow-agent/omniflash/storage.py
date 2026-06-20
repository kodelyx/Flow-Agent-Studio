"""Cloudflare R2 object storage for generated media.

Uploads go through a small Cloudflare Worker bound to the R2 bucket
(R2_UPLOAD_URL) instead of the S3 API — the S3 endpoint
(*.r2.cloudflarestorage.com) is unreachable from some networks/datacenters,
whereas the Worker (and the public r2.dev read URL) are normal Cloudflare hosts.

Holds the actual image/video bytes so they survive Hugging Face Space restarts
(the container disk is ephemeral). Enabled only when all R2 settings are present;
otherwise `is_enabled()` returns False and the API falls back to serving files
from local disk via `/download/<file>`.

Uses only the stdlib (urllib) — no extra dependency.
"""

import logging
import os
import urllib.error
import urllib.request

log = logging.getLogger("omniflash.storage")

# Base URL of the upload Worker (PUT/DELETE /<key>, Bearer-authed)
R2_UPLOAD_URL = os.environ.get("R2_UPLOAD_URL", "").rstrip("/")
R2_UPLOAD_SECRET = os.environ.get("R2_UPLOAD_SECRET", "")
# Public read base (r2.dev managed domain or a custom domain)
R2_PUBLIC_BASE = os.environ.get("R2_PUBLIC_BASE", "").rstrip("/")

# Cloudflare blocks the default Python-urllib User-Agent (error 1010), so present
# a normal browser signature.
_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
)


def is_enabled() -> bool:
    """True only when the upload Worker + public base are configured."""
    return all([R2_UPLOAD_URL, R2_UPLOAD_SECRET, R2_PUBLIC_BASE])


def upload(local_path: str, key: str, content_type: str) -> str:
    """Upload `local_path` to R2 under `key` via the Worker; return its public URL.

    Blocking — call from async code via `asyncio.to_thread`.
    """
    with open(local_path, "rb") as f:
        data = f.read()
    req = urllib.request.Request(
        f"{R2_UPLOAD_URL}/{key}",
        data=data,
        method="PUT",
        headers={
            "Authorization": f"Bearer {R2_UPLOAD_SECRET}",
            "Content-Type": content_type,
            "User-Agent": _UA,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        body = b""
        try:
            body = e.read()[:300]
        except Exception:
            pass
        log.error("R2 worker PUT %s -> %s: %s", key, e.code, body)
        raise
    log.info("☁️  Uploaded to R2: %s", key)
    return f"{R2_PUBLIC_BASE}/{key}"


def delete(key: str) -> None:
    """Best-effort delete of an R2 object via the Worker (never raises)."""
    try:
        req = urllib.request.Request(
            f"{R2_UPLOAD_URL}/{key}",
            method="DELETE",
            headers={"Authorization": f"Bearer {R2_UPLOAD_SECRET}", "User-Agent": _UA},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp.read()
        log.info("🗑️  Deleted from R2: %s", key)
    except Exception as e:  # noqa: BLE001 - best effort
        log.warning("R2 delete failed for %s: %s", key, e)
