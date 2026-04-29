"""
WARDEN — User & Token Management CLI
Usage:
    python scripts/manage_users.py token          # Generate a dev token
    python scripts/manage_users.py create-sim     # Create simulation_engine user in Firebase
    python scripts/manage_users.py check-staff    # List all staff users
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from jose import jwt
from datetime import datetime, timedelta, timezone
from core.config import settings


def generate_token():
    """Generate a dev/simulation JWT token."""
    user_data = {
        "id": "sim-id-001",
        "username": "simulation_engine",
        "role": "staff",
        "staff_role": "admin",
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    token = jwt.encode(user_data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    print(f"TOKEN: {token}")
    return token


def create_sim_user():
    """Create the simulation_engine user in Firestore."""
    from services.auth_service import register_staff
    from utils.auth import create_token
    from services.db_service import db

    user_data = {
        "username": "simulation_engine",
        "password": "secure_sim_password_123",
        "role": "admin",
        "name": "Simulation Engine"
    }

    token = register_staff(user_data)
    if token:
        print(f"User created successfully!")
        print(f"TOKEN: {token}")
    else:
        docs = db.collection("staff").where("username", "==", "simulation_engine").limit(1).stream()
        staff = next((d.to_dict() for d in docs), None)
        if staff:
            token = create_token({"id": staff["id"], "username": staff["username"], "role": "staff", "staff_role": staff["role"]})
            print(f"User already exists. Generated new token.")
            print(f"TOKEN: {token}")


def check_staff():
    """List all staff users from Firestore."""
    from services.db_service import db
    docs = db.collection("staff").stream()
    for doc in docs:
        print(f"ID: {doc.id}, Data: {doc.to_dict()}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1].lower()
    commands = {
        "token": generate_token,
        "create-sim": create_sim_user,
        "check-staff": check_staff,
    }

    if command in commands:
        commands[command]()
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)
