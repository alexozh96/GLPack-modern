"""Simple in-process rate limiter for the login endpoint.

Behind a reverse proxy, set TRUSTED_PROXIES to a comma-separated list of
proxy IPs (e.g. "10.0.0.1,10.0.0.2"). When the incoming connection comes from
a trusted proxy the real client IP is read from the leftmost X-Forwarded-For
value, preventing both IP spoofing and rate-limit bypass.
"""
import os
import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request

_attempts: dict[str, list[float]] = defaultdict(list)
_lock = Lock()

_TRUSTED_PROXIES: set[str] = {
    ip.strip() for ip in os.getenv("TRUSTED_PROXIES", "").split(",") if ip.strip()
}


def _get_client_ip(request: Request) -> str:
    peer_ip = request.client.host if request.client else "unknown"
    if peer_ip in _TRUSTED_PROXIES:
        forwarded_for = request.headers.get("X-Forwarded-For", "")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
    return peer_ip


def _check(ip: str, max_requests: int = 10, window_seconds: int = 60) -> None:
    now = time.time()
    with _lock:
        cutoff = now - window_seconds
        recent = [t for t in _attempts.get(ip, []) if t > cutoff]
        if len(recent) >= max_requests:
            _attempts[ip] = recent
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts. Please try again in a minute.",
            )
        recent.append(now)
        _attempts[ip] = recent


def login_rate_limit(request: Request) -> None:
    """FastAPI dependency — raises 429 after 10 login attempts per IP per minute."""
    _check(_get_client_ip(request))
