from utils.auth import verify_password, create_token, hash_password
from services.db_service import db
import uuid

def login_staff(username: str, password: str):
    if not db: return None
    docs = db.collection("staff").where("username", "==", username).limit(1).stream()
    staff = next((d.to_dict() for d in docs), None)
    if staff and verify_password(password, staff["password"]):
        return create_token({"id": staff["id"], "username": username, "role": "staff", "staff_role": staff["role"]})
    return None

def login_guest(username: str, password: str):
    if not db: return None
    docs = db.collection("guests").where("username", "==", username).limit(1).stream()
    guest = next((d.to_dict() for d in docs), None)
    if guest and verify_password(password, guest["password"]):
        return create_token({"id": guest["id"], "username": username, "role": "guest"})
    return None

def login_user(username: str, password: str):
    return login_staff(username, password) or login_guest(username, password)

def register_guest(data: dict):
    if not db: return None
    existing = db.collection("guests").where("username", "==", data["username"]).limit(1).stream()
    if next(existing, None):
        return None
    guest_id = str(uuid.uuid4())
    guest = {**data, "id": guest_id, "password": hash_password(data["password"])}
    db.collection("guests").document(guest_id).set(guest)
    return create_token({"id": guest_id, "username": data["username"], "role": "guest"})

def register_staff(data: dict):
    if not db: return None
    existing = db.collection("staff").where("username", "==", data["username"]).limit(1).stream()
    if next(existing, None):
        return None
    staff_id = str(uuid.uuid4())
    staff = {**data, "id": staff_id, "password": hash_password(data["password"])}
    db.collection("staff").document(staff_id).set(staff)
    return create_token({"id": staff_id, "username": data["username"], "role": "staff", "staff_role": data["role"]})
