from pydantic import BaseModel
from typing import Dict, Any, List, Optional

class Alert(BaseModel):
    id: str
    source: str
    location: Dict[str, Any]
    metadata: Dict[str, Any]
    timestamp: float
    ai_summary: Optional[str] = None
    detailed_report: Optional[str] = None
    media_attachments: List[str] = []
    status: str = "pending"  # pending, responding, resolved