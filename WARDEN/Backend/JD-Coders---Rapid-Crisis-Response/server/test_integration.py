import asyncio
import httpx
import json
import websockets
import time

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000/ws/alerts"

async def test_alert_flow():
    print("\n--- Starting Integration Test: Alert Flow ---")
    
    # 1. Start listening to WebSockets
    # Note: We need a token if auth is enabled. For now, let's assume we can connect or use a dummy.
    # Looking at main.py, it requires a token.
    # Let's skip WS for a second or use a mock if possible.
    # Actually, let's just test the REST endpoints first.
    
    async with httpx.AsyncClient() as client:
        # Test Health
        resp = await client.get(f"{BASE_URL}/health")
        print(f"[HEALTH] {resp.status_code} - {resp.json()}")
        assert resp.status_code == 200

        # Test Alert Reception
        test_alert = {
            "source": "sensor",
            "location": {"floor": 1, "room": "101", "area": "Lobby", "node": "N1"},
            "metadata": {"incident_type": "fire", "severity": "high", "event_msg": "Smoke detected"},
            "timestamp": time.time()
        }
        
        print("[REST] Sending test alert...")
        resp = await client.post(f"{BASE_URL}/alert", json=test_alert)
        print(f"[REST] Response: {resp.status_code} - {resp.json()}")
        assert resp.status_code == 200

        # Wait for worker to process the bucket
        print("[WORKER] Waiting for background processing...")
        await asyncio.sleep(1.0)

        # Test Responder API (Checking if alert was stored in memory)
        resp = await client.get(f"{BASE_URL}/responder/alerts")
        alerts = resp.json().get("alerts", [])
        print(f"[REST] Stored alerts count: {len(alerts)}")
        if not alerts:
             print("[ERROR] Alert was not found in responder store!")
        assert len(alerts) > 0
        
        # Test AI Route (Verify route ordering fix)
        print("[AI] Testing AI chat route...")
        ai_payload = {"message": "How do I exit?", "context": "Fire on floor 1"}
        resp = await client.post(f"{BASE_URL}/api/ai/chat", json=ai_payload)
        print(f"[AI] AI Status: {resp.status_code}")
        # 200 = Success, 500 = AI Key Missing/Error, but NOT 404
        assert resp.status_code != 404

    print("--- Integration Test Complete ---")

if __name__ == "__main__":
    # This script assumes the server is running.
    # To run: .venv/Scripts/python test_integration.py
    try:
        asyncio.run(test_alert_flow())
    except Exception as e:
        print(f"Test Failed: {e}")
