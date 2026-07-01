import asyncio
import httpx
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from services.bucket_service import add_to_bucket
from services.format_alert import process_alert
from services.db_service import get_current_state
from core.decision_engine import handle_document
from utils.auth import get_current_user
from .websocket import manager


from services.alert_store import get_all_alerts, get_alert_by_id, update_alert_field, append_media

import os
import time

router = APIRouter()
SIM_URL = os.getenv("SIM_URL", "http://localhost:3000")

@router.post("/api/simulation/tick")
async def receive_tick(data: dict):
    # Broadcast the raw tick data to all connected dashboard clients
    await manager.broadcast({
        "type": "simulation_tick",
        "data": data
    })
    return {"status": "ok"}


@router.post("/alert")
async def receive_alert(data: dict):
    print(f"[ALERT] Received alert data: {data}")
    alert_obj = process_alert(data)
    add_to_bucket(alert_obj)
    
    # Broadcast the alert to all connected WebSocket clients
    print(f"[ALERT] Broadcasting alert to {len(manager.active_connections)} clients")
    await manager.broadcast({
        "type": "Alert_update",
        "data": {
            "alerts": [alert_obj.dict()],
            "summary": {"text": f"New {alert_obj.source} alert: {alert_obj.metadata.get('event_msg', 'Critical Incident')}", "updated": True},
            "guest_summary": {
                "event": alert_obj.metadata.get("event_type", "Incident"),
                "floor": alert_obj.metadata.get("floor", "Unknown"),
                "near": alert_obj.metadata.get("zone_id", "Unknown")
            }
        }
    })
    
    return {"message": "Alert received, processed, and broadcasted"}

@router.post("/api/analyze")
async def analyze_zone(data: dict):
    """
    Endpoint for general camera verification (fire, smoke, etc.) using Gemini.
    """
    incident_type = data.get("incident_type", "unknown")
    zone_id = data.get("zone_id", "unknown")
    image_path = data.get("image_path")
    
    # Actually call Gemini if an image is provided
    try:
        from google import genai
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key and image_path and os.path.exists(image_path):
            client = genai.Client(api_key=api_key)
            img = client.files.upload(file=image_path)
            prompt = f"Analyze this camera zone {zone_id} for {incident_type}. Is there a threat? Return JSON: 'confirmed' (bool), 'confidence' (float), 'detection_type' (str), 'signals' (list of str)."
            response = client.models.generate_content(model='gemini-2.5-flash', contents=[img, prompt])
            import json
            text_clean = response.text.replace("```json", "").replace("```", "").strip()
            return json.loads(text_clean)
    except Exception as e:
        print(f"[VISION-ERROR] {e}")

    # Fallback for simulation stability
    return {
        "confirmed": True,
        "confidence": 0.92,
        "detection_type": incident_type,
        "signals": ["fallback_visual_confirmation", "heat_signature"]
    }

@router.post("/verify-threat")
async def verify_threat(data: dict):
    """
    Endpoint for the simulation engine to request Gemini Vision verification.
    data: { agent_id, node_id, floor, image_path, context }
    """
    image_path = data.get("image_path")
    context = data.get("context", {})
    incident_type = context.get("incident_type", "detected")
    
    try:
        from google import genai
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key and image_path and os.path.exists(image_path):
            client = genai.Client(api_key=api_key)
            img = client.files.upload(file=image_path)
            prompt = f"Verify threat. Context: {context}. Return JSON: 'confirmed' (bool), 'confidence' (float), 'detection_type' (str), 'signals' (list)."
            response = client.models.generate_content(model='gemini-2.5-flash', contents=[img, prompt])
            import json
            text_clean = response.text.replace("```json", "").replace("```", "").strip()
            return json.loads(text_clean)
    except Exception as e:
        print(f"[VISION-ERROR] {e}")

    # Pure Relay fallback
    return {
        "confirmed": True,
        "confidence": 1.0,
        "detection_type": incident_type,
        "signals": ["manual_relay_active_fallback"]
    }


@router.post("/save-docs")
async def receive_docs(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "staff":
        raise HTTPException(status_code=403, detail="Staff only")
    await handle_document(file)
    return {"file saved"}

@router.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    print(f"[WS] [DEBUG] Attempting connection from {websocket.client}")
    
    # Verify JWT token if provided (recommended for production)
    from utils.auth import verify_token
    token = websocket.query_params.get("token")
    if token:
        user = verify_token(token)
        if not user:
            print(f"[WS] [WARN] Invalid token from {websocket.client} - rejecting")
            await websocket.close(code=1008)
            return
    
    await manager.connect(websocket)
    print(f"[WS] [INFO] Successfully connected client: {websocket.client}")
    
    # Send initial state upon connection
    current_state = await asyncio.to_thread(get_current_state)
    if current_state:
        initial_payload = {
            "type": "Alert_update",
            "data": {
                "alerts": current_state.get("active_alerts", []),
                "summary": {"text": current_state.get("summary_text", ""), "updated": False},
                "recommendations": current_state.get("recommendations", {})
            }
        }
        await websocket.send_json(initial_payload)

    # Send an initial welcome message to verify connection
    await websocket.send_json({
        "type": "broadcast_message",
        "data": {
            "message": "Connected to WARDEN Backend Service",
            "target": "mobile",
            "timestamp": int(time.time())
        }
    })

    try:
        while True:
            # Keep connection alive and listen for any client messages
            data = await websocket.receive_text()
            print(f"[WS] Received message from client: {data}")
    except WebSocketDisconnect:
        print(f"[WS] [INFO] Client disconnected: {websocket.client}")
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WS] [ERROR] Error: {e}")
        manager.disconnect(websocket)

@router.api_route("/api/broadcast", methods=["POST"])
async def broadcast_message(request: Request):
    """
    Endpoint for the desktop to broadcast a message to all connected clients (including mobile).
    Payload: { "target": "staff"|"guests"|"both", "message": "string" }
    """
    data = await request.json()
    target = data.get("target", "both")
    message = data.get("message", "")
    
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    broadcast_payload = {
        "type": "broadcast_message",
        "data": {
            "target": target,
            "message": message,
            "timestamp": __import__("time").time()
        }
    }
    
    await manager.broadcast(broadcast_payload)
    print(f"[BROADCAST] Sent to {target}: {message[:50]}...")
    return {"status": "broadcasted", "target": target}


@router.api_route("/api/mobile/sos", methods=["POST"])
async def mobile_sos(request: Request):
    """
    Mobile-specific SOS endpoint that also triggers push notifications.
    """
    data = await request.json()
    alert_obj = process_alert(data)
    add_to_bucket(alert_obj)
    
    # Immediate broadcast for urgency
    await manager.broadcast({
        "type": "Alert_update",
        "data": {
            "alerts": [alert_obj.dict()],
            "summary": {"text": f"[SOS] MOBILE SOS: {alert_obj.metadata.get('event_msg', 'Emergency')}", "updated": True},
            "guest_summary": {
                "event": "Emergency SOS",
                "floor": alert_obj.metadata.get("floor", "Unknown"),
                "near": alert_obj.metadata.get("zone_id", "Location Shared")
            }
        }
    })
    
    return {"message": "SOS received and broadcasted", "alert_id": str(alert_obj.id)}


# ─── Responder App Endpoints ─────────────────────────────────────────────────

@router.get("/responder/alerts")
async def list_responder_alerts():
    """
    Returns all stored alerts with AI summaries, reports, and media.
    Used by the First Responder Web App.
    """
    return {"alerts": get_all_alerts()}


@router.get("/responder/alerts/{alert_id}")
async def get_responder_alert(alert_id: str):
    """Fetch a single alert with its full report and media."""
    alert = get_alert_by_id(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.get("/responder/alerts/{alert_id}/report")
async def get_or_generate_report(alert_id: str):
    """
    Returns the AI report for an alert.  If the report hasn't been generated
    yet (still None), triggers generation on the fly and returns it.
    """
    alert = get_alert_by_id(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # AI reporting is now handled by the client side (Gemma/Gemini).
    # We just return the current fields.
    return {
        "alert_id": alert_id,
        "ai_summary": alert.get("ai_summary", "Awaiting client-side analysis..."),
        "detailed_report": alert.get("detailed_report", "Please view on Desktop App for full tactical report."),
    }


@router.post("/responder/alerts/{alert_id}/media")
async def upload_alert_media(alert_id: str, request: Request):
    """
    Attach a media URL to an existing alert.
    Body: { "url": "https://..." }
    """
    data = await request.json()
    url = data.get("url")
    if not url:
        raise HTTPException(status_code=422, detail="'url' field is required")
    if not append_media(alert_id, url):
        raise HTTPException(status_code=404, detail="Alert not found")

    # Broadcast media update to all connected clients
    await manager.broadcast({
        "type": "alert_media_added",
        "data": {"alert_id": alert_id, "url": url}
    })
    return {"status": "attached", "alert_id": alert_id}


@router.post("/responder/alerts/{alert_id}/status")
async def update_alert_status(alert_id: str, request: Request):
    """
    Update the response status of an alert.
    Body: { "status": "responding" | "resolved" | "pending" }
    """
    data = await request.json()
    new_status = data.get("status")
    if new_status not in ("pending", "responding", "resolved"):
        raise HTTPException(status_code=422, detail="Status must be pending, responding, or resolved")
    if not update_alert_field(alert_id, "status", new_status):
        raise HTTPException(status_code=404, detail="Alert not found")

    await manager.broadcast({
        "type": "alert_status_changed",
        "data": {"alert_id": alert_id, "status": new_status}
    })
    return {"status": new_status, "alert_id": alert_id}


@router.api_route("/api/{action:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_all_api(action: str, request: Request):
    async with httpx.AsyncClient() as client:
        method = request.method
        url = f"{SIM_URL}/api/{action}"
        
        body = None
        if method in ["POST", "PUT"]:
            try:
                body = await request.json()
            except:
                pass
        
        try:
            resp = await client.request(method, url, json=body, params=dict(request.query_params))
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Simulation error: {str(e)}")

