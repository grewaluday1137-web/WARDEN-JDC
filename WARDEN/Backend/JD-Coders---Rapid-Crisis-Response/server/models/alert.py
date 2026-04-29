from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

class GuestAlert(BaseModel):
    source: str
    name: Optional[str] = "Guest Device"
    room_no: Optional[int] = None
    floor_no: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: Optional[float] = None


class CameraAlert(BaseModel):
    source: str
    location: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: Optional[float] = None


class SensorAlert(BaseModel):
    source: str
    location: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: Optional[float] = None


class UnknownAlert(BaseModel):
    source: str
    location: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: Optional[float] = None