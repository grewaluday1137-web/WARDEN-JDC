from pydantic import BaseModel
from typing import Dict, Any

class Guest(BaseModel):
    username: str
    phone: str
    room_no: int
    floor:int
    password: str
    metadata: Dict[str, Any] = {}

#Staff model for hotel staff members

class Staff(BaseModel):
    username: str
    email: str
    phone: str
    password: str
    role: str
    metadata: Dict[str, Any] = {}
