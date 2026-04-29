from datetime import datetime, timezone
from threading import Lock

bucket = []
_lock = Lock()
DEDUP_WINDOW_SECONDS = 5  # Reduced from 60 to 5 for better responsiveness

def _fingerprint(alert) -> str:
    loc = alert.location
    crisis = alert.metadata.get("incident_type") or alert.metadata.get("type") or ""
    return f"{alert.source}|{loc.get('floor')}|{loc.get('room')}|{loc.get('area')}|{crisis}"

def _is_duplicate(alert) -> bool:
    fp = _fingerprint(alert)
    now_ts = datetime.now(timezone.utc).timestamp()
    for existing in bucket:
        age = now_ts - existing.timestamp
        if _fingerprint(existing) == fp and age <= DEDUP_WINDOW_SECONDS:
            return True
    return False

def add_to_bucket(alert):
    with _lock:
        if _is_duplicate(alert):
            print("Duplicate alert dropped")
            return
        bucket.append(alert)
        print("Bucket appended")

def get_next_alert():
    with _lock:
        if bucket:
            data = bucket.copy()
            bucket.clear()
            # Use safe encoding for Windows consoles
            try:
                print(f"Bucket received: {len(data)} alerts")
            except:
                print("Bucket received alerts (undisplayable characters)")
            return data