import requests
import json
import time

URL = "http://localhost:8000/alert"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InNpbS1pZC0wMDEiLCJ1c2VybmFtZSI6InNpbXVsYXRpb25fZW5naW5lIiwicm9sZSI6InN0YWZmIiwic3RhZmZfcm9sZSI6ImFkbWluIiwiZXhwIjoxNzc5OTY1NTMzfQ.MVKaRmIT313-_v8vNa3UYyf2KktFlmXLtflhqTzh_co"

def test_alert():
    payload = {
        "source": "sensor",
        "location": {
            "floor": 1,
            "room": 101,
            "area": "North Wing"
        },
        "metadata": {
            "incident_type": "fire",
            "intensity": "critical",
            "node_name": "Test Node"
        },
        "timestamp": time.time()
    }
    
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(URL, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_alert()
