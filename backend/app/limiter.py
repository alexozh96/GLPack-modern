"""Simple in-process rate limiter for the login endpoint."""
import time
from collections import defaultdict
from threading import Lock
from fastapi import HTTPException, Request

_attempts: dict[str, list[float]] = defaultdict(list)
_lock = Lock()


def _check(ip: str, max_requests: int = 10, window_seconds: int = 60) -> None:
    now = time.time()
    with _lock:
        cutoff = now - window_seconds
        _attempts[ip] = [t for t in _attempts[ip] if t > cutoff]
        if len(_attempts[ip]) >= max_requests:
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts. Please try again in a minute.",
            )
        _attempts[ip].append(now)


def login_rate_limit(request: Request) -> None:
    """FastAPI dependency — raises 429 after 10 login attempts per IP per minute."""
    ip = request.client.host if request.client else "unknown"
    _check(ip)
