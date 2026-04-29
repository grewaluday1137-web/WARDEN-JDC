"""
In-memory alert store for the Responder Web App.
Stores processed alerts with AI reports and media attachments,
keyed by alert ID for fast lookup.
"""

from threading import Lock

_lock = Lock()
_alerts: dict[str, dict] = {}   # alert_id -> full alert dict


def store_alert(alert_dict: dict):
    """Store or update an alert by its ID."""
    alert_id = alert_dict.get("id")
    if not alert_id:
        return
    with _lock:
        existing = _alerts.get(alert_id)
        if existing:
            existing.update(alert_dict)
        else:
            _alerts[alert_id] = alert_dict


def get_alert_by_id(alert_id: str) -> dict | None:
    """Retrieve a single alert by ID."""
    with _lock:
        return _alerts.get(alert_id)


def get_all_alerts() -> list[dict]:
    """Return all stored alerts, sorted newest first."""
    with _lock:
        return sorted(
            _alerts.values(),
            key=lambda a: a.get("timestamp", 0),
            reverse=True,
        )


def update_alert_field(alert_id: str, field: str, value) -> bool:
    """Update a single field on an existing alert. Returns False if not found."""
    with _lock:
        alert = _alerts.get(alert_id)
        if alert is None:
            return False
        alert[field] = value
        return True


def append_media(alert_id: str, url: str) -> bool:
    """Append a media URL to an alert's media_attachments list."""
    with _lock:
        alert = _alerts.get(alert_id)
        if alert is None:
            return False
        alert.setdefault("media_attachments", []).append(url)
        return True
