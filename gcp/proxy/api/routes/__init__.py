from fastapi import FastAPI
from .health import router as health_router
from .telegram import router as telegram_router
from .firebase import router as firebase_router
from .document import router as document_router
from .service_broker import router as service_broker_router

def register_routes(app: FastAPI):
    """
    Register all API routers to the FastAPI application.
    """
    app.include_router(health_router)
    app.include_router(telegram_router)
    app.include_router(firebase_router)
    app.include_router(document_router)
    app.include_router(service_broker_router)

__all__ = ["register_routes"]
