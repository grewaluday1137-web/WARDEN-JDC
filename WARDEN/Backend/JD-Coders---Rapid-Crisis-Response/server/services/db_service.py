import os

# Firebase is temporarily disabled to prevent 5-minute timeout hangs 
# due to the invalid 'invalid_grant: account not found' credentials.
db = None

def save_alert_from_bucket(alerts: list):
    """Mock persist raw alerts."""
    print(f"[DB-MOCK] Would save {len(alerts)} alerts to Firestore (Disabled)")

def get_alert():
    """Mock get alerts."""
    return []

def save_state(ai_output_dict):
    """Mock persist the AI-scored state snapshot."""
    alerts_list = ai_output_dict.get("alerts", [])
    print(f"[DB-MOCK] Would update live state with {len(alerts_list)} alerts (Disabled)")

def get_current_state():
    """Mock retrieve the latest live state snapshot."""
    return None
