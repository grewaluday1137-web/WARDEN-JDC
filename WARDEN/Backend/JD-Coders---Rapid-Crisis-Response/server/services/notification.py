from services.db_service import db

HIGH_SEVERITY_THRESHOLD = 75
FCM_BATCH_SIZE = 500


def _get_staff_tokens() -> list[str]:
    if db is None:
        return []
    try:
        docs = db.collection("staff").stream()
        return [d.to_dict()["fcm_token"] for d in docs if d.to_dict() and d.to_dict().get("fcm_token")]
    except Exception as e:
        print(f"[NOTIFY] Failed to fetch staff tokens: {e}")
        return []


def _remove_stale_tokens(invalid_tokens: list[str]):
    if db is None:
        return
    try:
        docs = db.collection("staff").stream()
        for d in docs:
            data = d.to_dict()
            if data and data.get("fcm_token") in invalid_tokens:
                db.collection("staff").document(d.id).update({"fcm_token": ""})
    except Exception as e:
        print(f"[NOTIFY] Failed to remove stale tokens: {e}")


def _send_multicast(tokens: list[str], title: str, body: str):
    try:
        from firebase_admin import messaging
    except ImportError:
        print("[NOTIFY] firebase_admin not available — skipping FCM push.")
        return

    for i in range(0, len(tokens), FCM_BATCH_SIZE):
        batch = tokens[i:i + FCM_BATCH_SIZE]
        message = messaging.MulticastMessage(
            tokens=batch,
            notification=messaging.Notification(title=title, body=body),
            android=messaging.AndroidConfig(priority="high"),
            apns=messaging.APNSConfig(headers={"apns-priority": "10"}),
        )
        try:
            response = messaging.send_each_for_multicast(message)
            stale = [batch[j] for j, r in enumerate(response.responses) if not r.success]
            if stale:
                _remove_stale_tokens(stale)
            print(f"FCM batch: {response.success_count} ok, {response.failure_count} failed")
        except Exception as e:
            print(f"[NOTIFY] FCM send failed: {e}")


def notify_high_severity(scored_alerts: list):
    """Send FCM push notifications for high-severity alerts. Fully wrapped in try/except."""
    try:
        high = [a for a in scored_alerts if a.get("score", 0) >= HIGH_SEVERITY_THRESHOLD]
        if not high:
            return

        tokens = _get_staff_tokens()
        if not tokens:
            print("[NOTIFY] No staff FCM tokens found (or Firebase disabled)")
            return

        for alert in high:
            alert_id = alert.get("id", "unknown")
            floor = alert.get("location", {}).get("floor", "?")
            source = alert.get("source", "unknown")
            score = alert.get("score", 0)
            reason = alert.get("reason", "")

            _send_multicast(
                tokens=tokens,
                title=f"Crisis Alert - Floor {floor}",
                body=f"{source.capitalize()} | Score {score} | {reason}",
            )
            print(f"FCM sent for alert {alert_id}")
    except Exception as e:
        print(f"[NOTIFY] FCM notification pipeline failed: {e}")
