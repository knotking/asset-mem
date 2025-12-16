class WorkerError(Exception):
    """Base exception for worker errors."""
    pass

class ConfigurationError(WorkerError):
    """Raised when configuration is invalid."""
    pass

class RagImportError(WorkerError):
    """Raised when RAG import fails."""
    pass

