import asyncio
from fastapi import APIRouter, Request, BackgroundTasks
from service_broker_api import handle_service_broker_payload

router = APIRouter()

@router.post("/service-broker/webhook")
async def service_broker_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Handle Service Broker agent webhooks.
    """
    try:
        payload = await request.json()
        
        # Determine how to run the async handler
        # Option 1: Run in background task (fire and forget from HTTP perspective)
        # background_tasks.add_task(handle_service_broker_payload, payload)
        
        # Option 2: Run directly and wait (if response depends on it)
        # await handle_service_broker_payload(payload)

        # Implementation in main.py suggested running on main_loop. 
        # Since we are in an async function, we are already on the loop.
        # But handle_service_broker_payload is async, so we can just await it 
        # or schedule it. The prompt mentioned "background processing".
        
        # Let's check how main.py was doing it.
        # It was importing router from service_broker module.
        # Wait, I am DEFINING the router now.
        
        # Let's just await it for now to ensure it runs, or use background tasks if it's slow.
        # Given the "asyncio.run_coroutine_threadsafe" pattern in events.py, 
        # maybe this is meant to be fire-and-forget.
        
        # Let's use FastAPI's BackgroundTasks for robust async processing
        background_tasks.add_task(handle_service_broker_payload, payload)
        
        return {"status": "accepted"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
