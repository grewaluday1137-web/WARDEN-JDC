from models import alert, state
import uuid
import time

def process_alert(data: dict):
    ran_uuid = str(uuid.uuid4())
    source = data.get("source", "").lower()

    if source == "guest":
        # Handle cases where location is passed as a dict (common in simulation)
        if "location" in data:
            loc = data["location"]
            data["floor_no"] = loc.get("floor")
            data["room_no"] = loc.get("room")
            # Set a default name if missing
            if "name" not in data:
                data["name"] = loc.get("area") or "Guest Device"
        
        guest = alert.GuestAlert(**data)

        location = {
            "floor": guest.floor_no,
            "room": guest.room_no,
            "area": data.get("location", {}).get("area"),
            "node": data.get("location", {}).get("node")
        }

        return state.Alert(
            id=ran_uuid,
            source="guest",
            location=location,
            metadata=guest.metadata or {},
            timestamp=guest.timestamp or time.time(),
        )

    elif source == "sensor":
        sensor = alert.SensorAlert(**data)

        location = {
            "floor": sensor.location.get("floor"),
            "room": sensor.location.get("room"),
            "area": sensor.location.get("area"),
            "node": sensor.location.get("node")
        }

        return state.Alert(
            id=ran_uuid,
            source="sensor",
            location=location,
            metadata=sensor.metadata or {},
            timestamp=sensor.timestamp or time.time(),
        )

    elif source == "camera":
        camera = alert.CameraAlert(**data)

        location = {
            "floor": camera.location.get("floor"),
            "room": camera.location.get("room"),
            "area": camera.location.get("area"),
            "node": camera.location.get("node")
        }

        return state.Alert(
            id=ran_uuid,
            source="camera",
            location=location,
            metadata=camera.metadata or {},
            timestamp=camera.timestamp or time.time(),
        )

    else:
        unknown = alert.UnknownAlert(**data)

        location = {
            "floor": unknown.location.get("floor"),
            "room": unknown.location.get("room"),
            "area": unknown.location.get("area"),
            "node": unknown.location.get("node")
        }

        return state.Alert(
            id=ran_uuid,
            source="unknown",
            location=location,
            metadata=unknown.metadata or {},
            timestamp=unknown.timestamp or time.time(),
        )