from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from models import user
from services.auth_service import login_user, register_guest, register_staff
from services.db_service import db
from utils.auth import get_current_user, require_staff

class FCMTokenBody(BaseModel):
    token: str

router = APIRouter()

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    token = login_user(form_data.username, form_data.password)
    if not token:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me")
def me(current_user: dict | None = Depends(get_current_user)):
    if current_user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user

@router.post("/signup/guest")
def signup_guest(body: user.Guest):
    token = register_guest(body.model_dump())
    if not token:
        raise HTTPException(status_code=409, detail="Username already exists")
    return {"access_token": token, "token_type": "bearer"}

@router.post("/signup/staff")
def signup_staff(body: user.Staff, current_user: dict = Depends(require_staff)):
    # only existing staff can create new staff accounts
    token = register_staff(body.model_dump())
    if not token:
        raise HTTPException(status_code=409, detail="Username already exists")
    return {"access_token": token, "token_type": "bearer"}

@router.post("/staff/register-token")
async def register_token(body: FCMTokenBody, current_user: dict = Depends(require_staff)):
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable — Firebase is disabled.")
    db.collection("staff").document(current_user["id"]).set(
        {"fcm_token": body.token}, merge=True
    )
    return {"status": "ok"}
