from services.db_service import save_alert_from_bucket, save_state, db, get_current_state
from services.notification import notify_high_severity
from services.alert_store import store_alert, update_alert_field
from api.websocket import manager
import asyncio

async def handle_alert(alerts: list):
    """
    Pure Data Relay: 
    1. Receives raw alerts.
    2. Normalizes & attaches media.
    3. Saves to Firestore (Persistence).
    4. Broadcasts to Desktop & Android apps (Real-time).
    """
    alerts_dict = [alert.model_dump() for alert in alerts]

    # Persistent DB save in background
    asyncio.create_task(asyncio.to_thread(save_alert_from_bucket, alerts_dict))

    processed_alerts = []
    for orig in alerts_dict:
        orig_copy = orig.copy()
        
        # Default values - Clients (Desktop/Android) will overwrite these with their own AI
        orig_copy.setdefault("score", 50)
        orig_copy.setdefault("reason", "Awaiting local tactical analysis...")
        orig_copy.setdefault("ai_summary", None)
        orig_copy.setdefault("detailed_report", None)
        orig_copy.setdefault("status", "pending")
        
        # Attach Evidence Media (Heuristic mapping)
        import os
        api_url = os.getenv("API_URL", "http://localhost:8000")
        media = []
        event_info = (str(orig.get("metadata", {})).lower() + " " + str(orig.get("source", "")).lower())
        if any(kw in event_info for kw in ["fire", "explosion", "smoke"]):
            media.append(f"{api_url}/static/Fire.jpeg")
        elif any(kw in event_info for kw in ["intrud", "unauthorized", "weapon", "shoot", "gun"]):
            media.append(f"{api_url}/static/Intruder%20alert.jpeg")
        elif any(kw in event_info for kw in ["structur", "earthquake", "collapse", "damage"]):
            media.append(f"{api_url}/static/Structural%20Damage.jpeg")
            
        orig_copy.setdefault("media_attachments", media)
        processed_alerts.append(orig_copy)
        
        # Update in-memory store for REST API polling
        store_alert(orig_copy)

    # Global state update (Simple metadata)
    state_payload = {
        "alerts": processed_alerts,
        "summary": {"text": f"Active events: {len(processed_alerts)}", "updated": True},
        "recommendations": {"staff": ["Manual verification in progress"], "guests": ["Stay alert"]}
    }

    # Broadcast to all connected apps (WebSockets)
    broadcast_payload = {
        "type": "Alert_update",
        "data": state_payload
    }
    
    # Fire and forget secondary tasks
    asyncio.create_task(asyncio.to_thread(save_state, state_payload))
    asyncio.create_task(asyncio.to_thread(notify_high_severity, processed_alerts))
    
    await manager.broadcast(broadcast_payload)
    try:
        print(f"[RELAY] Dispatched {len(processed_alerts)} alerts to tactical apps.")
    except:
        print("[RELAY] Dispatched alerts (undisplayable characters)")

async def handle_document(file):
    """Documents are now stored for local app retrieval."""
    content = await file.read()
    # Logic to store raw text for local RAG can be added here
    return {"status": "stored", "message": "Document available for local analysis."}