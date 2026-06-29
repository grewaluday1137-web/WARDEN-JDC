import os
import firebase_admin
from firebase_admin import credentials, firestore

db = None
try:
    key_path = os.getenv("FIREBASE_KEY_PATH", "firebase_key.json")
    if os.path.exists(key_path):
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("[DB] Firestore initialized successfully.")
    else:
        print(f"[DB-WARNING] Firebase key not found at {key_path}. Operating in mock mode.")
except Exception as e:
    print(f"[DB-ERROR] Firebase initialization failed ({e}). Operating in mock mode.")

def save_alert_from_bucket(alerts: list):
    """Persist raw alerts to Firestore, with a fallback to Mock."""
    if db:
        try:
            batch = db.batch()
            for alert in alerts:
                # Assuming alert is a dict or has a dict() method
                alert_dict = alert.dict() if hasattr(alert, 'dict') else alert
                doc_ref = db.collection("alerts").document(str(alert_dict.get("id")))
                batch.set(doc_ref, alert_dict, merge=True)
            batch.commit()
            print(f"[DB] Saved {len(alerts)} alerts to Firestore.")
        except Exception as e:
            print(f"[DB-ERROR] Failed to save alerts: {e}")
    else:
        print(f"[DB-MOCK] Would save {len(alerts)} alerts to Firestore (Disabled)")

def get_alert():
    """Get alerts from Firestore, with a fallback to Mock."""
    if db:
        try:
            docs = db.collection("alerts").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(100).stream()
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            print(f"[DB-ERROR] Failed to get alerts: {e}")
            return []
    else:
        print("[DB-MOCK] Getting alerts (Disabled)")
        return []

def save_state(ai_output_dict):
    """Persist the AI-scored state snapshot, with a fallback to Mock."""
    if db:
        try:
            doc_ref = db.collection("system_state").document("current")
            db.collection("system_state").document("current").set(ai_output_dict, merge=True)
            print("[DB] Updated live state in Firestore.")
        except Exception as e:
            print(f"[DB-ERROR] Failed to save state: {e}")
    else:
        alerts_list = ai_output_dict.get("alerts", [])
        print(f"[DB-MOCK] Would update live state with {len(alerts_list)} alerts (Disabled)")

def get_current_state():
    """Retrieve the latest live state snapshot from Firestore, with a fallback to Mock."""
    if db:
        try:
            doc = db.collection("system_state").document("current").get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            print(f"[DB-ERROR] Failed to get current state: {e}")
            return None
    else:
        return None
