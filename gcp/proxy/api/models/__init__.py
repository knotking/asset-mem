"""Models package initialization."""

# Import error models from subpackage
from .error_models import ErrorResponse, ErrorDetail

__all__ = [
    "ErrorResponse",
    "ErrorDetail",
]
