from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from api.ai_routes import router as ai_router
from api.auth_routes import router as auth_router
from api.guest_routes import router as guest_router
from api.routes import router
from api.websocket import manager
from utils.auth import verify_token

import asyncio
from workers.worker import start_worker

worker_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown lifecycle."""
    global worker_task
    worker_task = asyncio.create_task(start_worker())
    print("[WARDEN] Server started. Worker running.")
    yield
    if worker_task:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            print("[WORKER] Worker task cancelled successfully.")


app = FastAPI(
    title="WARDEN Crisis Response API",
    version="1.0.0",
    lifespan=lifespan,
)

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://localhost:1420,tauri://localhost").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Welcome endpoint to verify server is live."""
    return {
        "message": "WARDEN Crisis Response API is live.",
        "status": "active",
        "documentation": "/docs"
    }


# IMPORTANT: Specific routers MUST be registered before the catch-all proxy
# in routes.py (/api/{action:path}), otherwise those routes get intercepted.
app.include_router(ai_router, prefix="/api/ai")
app.include_router(auth_router, prefix="/auth")
app.include_router(guest_router, prefix="/auth")
app.include_router(router)   # Contains the /api/{action:path} catch-all — must be LAST


@app.get("/health")
async def health_check():
    """Health check endpoint for all frontends to verify backend availability."""
    return {
        "status": "ok",
        "worker_running": worker_task is not None and not worker_task.done() if worker_task else False,
        "websocket_clients": len(manager.active_connections),
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return
    user = verify_token(token)
    if not user:
        await websocket.close(code=1008)
        return
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    finally:
        manager.disconnect(websocket)
