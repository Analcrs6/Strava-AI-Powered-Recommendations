"""
Custom Middleware for Security and Performance
Includes rate limiting, CORS, and request logging
"""
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
from datetime import datetime, timedelta
import time
import logging

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple in-memory rate limiting middleware.
    For production, use Redis-based rate limiting.
    """
    
    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests = defaultdict(list)  # {ip: [timestamp1, timestamp2, ...]}
    
    async def dispatch(self, request: Request, call_next):
        # Get client IP
        client_ip = request.client.host
        
        # Skip rate limiting for health checks
        if request.url.path == "/health":
            return await call_next(request)
        
        # Clean old timestamps (older than 1 minute)
        now = datetime.utcnow()
        cutoff = now - timedelta(minutes=1)
        self.requests[client_ip] = [
            ts for ts in self.requests[client_ip] 
            if ts > cutoff
        ]
        
        # Check rate limit
        if len(self.requests[client_ip]) >= self.requests_per_minute:
            logger.warning(f"⚠️  Rate limit exceeded for IP: {client_ip}")
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too Many Requests",
                    "message": f"Rate limit exceeded. Maximum {self.requests_per_minute} requests per minute.",
                    "retry_after": 60
                },
                headers={"Retry-After": "60"}
            )
        
        # Add current timestamp
        self.requests[client_ip].append(now)
        
        # Add rate limit headers
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(
            self.requests_per_minute - len(self.requests[client_ip])
        )
        response.headers["X-RateLimit-Reset"] = str(int((now + timedelta(minutes=1)).timestamp()))
        
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Log all requests with timing information.
    """
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log request
        logger.info(
            f"{request.method} {request.url.path} "
            f"- Status: {response.status_code} "
            f"- Duration: {duration:.3f}s "
            f"- IP: {request.client.host}"
        )
        
        # Add timing header
        response.headers["X-Process-Time"] = str(duration)
        
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all responses.
    """
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response

