"""
Guest Routes — OTP-based guest check-in for WARDEN.

Flow:
  1. POST /auth/guest/request-otp  — collect name/room/email/phone, send OTP via Twilio
  2. POST /auth/guest/verify-otp   — validate OTP, return JWT for Android app login
"""
import os
import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.otp_service import send_otp, verify_otp, normalize_phone, find_to_by_otp
from utils.auth import create_token  # reuse the existing JWT helper

router = APIRouter()

# In-memory guest session store (keyed by phone or email)
# Replace with Firestore for production persistence.
_pending_guests: dict[str, dict] = {}


# ─── Request models ──────────────────────────────────────────────────────────

class OTPRequestBody(BaseModel):
    name: str
    room_number: str
    email: str  # Mandatory for email-only OTP
    phone: Optional[str] = None  # Kept for metadata but not used for auth


class OTPVerifyBody(BaseModel):
    otp: str
    email: Optional[str] = None  # Optional now to support OTP-only login


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _resolve_channel(body: OTPRequestBody) -> tuple[str, str]:
    """Return (to, channel) for Twilio Verify. Strictly email."""
    if body.email and body.email.strip():
        return body.email.strip(), "email"
    raise HTTPException(status_code=422, detail="Provide a valid email address.")


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/guest/request-otp")
async def request_otp(body: OTPRequestBody):
    """
    Register a guest and send them an OTP via SMS or email.
    """
    to, channel = _resolve_channel(body)

    # Persist guest details temporarily so we can look them up on verify
    _pending_guests[to] = {
        "name": body.name,
        "room_number": body.room_number,
        "email": body.email,
        "phone": body.phone,
        "created_at": time.time(),
    }

    result = send_otp(to, channel)
    
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))

    return {
        "status": "otp_sent",
        "channel": channel,
        "dev_mode": result.get("dev_mode", False),
    }


@router.post("/guest/verify-otp")
async def verify_otp_endpoint(body: OTPVerifyBody):
    """
    Verify the OTP. On success, return a JWT for the Android app.
    """
    # ─── Master Override for Testing ──────────────────────────────────────────
    if body.otp == "000000":
        to = (body.email or "test@warden.com").strip() or "test@warden.com"
        print(f"[OTP] [MASTER OVERRIDE] used for {to}")
        token = create_token({
            "sub": to,
            "name": "Test Guest",
            "room": "999",
            "role": "guest",
        })
        return {"access_token": token, "token_type": "bearer", "name": "Test Guest"}
    # ──────────────────────────────────────────────────────────────────────────

    to = body.email.strip() if body.email else None
    
    if not to:
        # Reverse lookup by OTP
        to = find_to_by_otp(body.otp)
        if not to:
            raise HTTPException(status_code=401, detail="Invalid code or code expired. Please check your email.")

    guest = _pending_guests.get(to)
    if not guest:
        raise HTTPException(status_code=404, detail="No pending registration found for this email. Please request a new OTP.")

    # Check session hasn't expired (15 minutes)
    if time.time() - guest["created_at"] > 900:
        _pending_guests.pop(to, None)
        raise HTTPException(status_code=410, detail="OTP session expired. Please request a new OTP.")

    approved = verify_otp(to, body.otp)
    if not approved:
        raise HTTPException(status_code=401, detail="Invalid or expired OTP.")

    # Clean up session
    _pending_guests.pop(to, None)

    # Issue a short-lived JWT for the Android app
    token = create_token({
        "sub": to,
        "name": guest["name"],
        "room": guest["room_number"],
        "role": "guest",
    })

    return {"access_token": token, "token_type": "bearer", "name": guest["name"]}
