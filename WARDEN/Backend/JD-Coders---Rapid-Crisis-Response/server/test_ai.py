import requests

URL = "http://localhost:8000/api/ai/chat"
payload = {
    "message": "Where is the nearest exit?",
    "context": "There is a fire on the 3rd floor."
}

try:
    response = requests.post(URL, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
