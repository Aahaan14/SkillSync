"""
Career Copilot - Shared OpenAPI error responses

Every error body is ``{"detail": "<message>"}`` (ErrorResponse), except 422 which
is ``{"detail": [{"loc", "msg", "type"}, ...]}`` (ValidationErrorResponse).
Declaring them here keeps /openapi.json honest about what clients can receive.
"""

from typing import Any, Dict

from app.schemas import ErrorResponse, ValidationErrorResponse

Responses = Dict[int | str, Dict[str, Any]]

UNAUTHORIZED: Responses = {
    401: {"model": ErrorResponse, "description": "Missing, invalid or expired credentials"},
}
FORBIDDEN: Responses = {
    403: {"model": ErrorResponse, "description": "Authenticated but not allowed (e.g. admin only)"},
}
VALIDATION: Responses = {
    422: {"model": ValidationErrorResponse, "description": "Request body failed validation"},
}
SERVER_ERROR: Responses = {
    500: {"model": ErrorResponse, "description": "Unexpected server error (no internal details)"},
}


def not_found(description: str) -> Responses:
    return {404: {"model": ErrorResponse, "description": description}}
