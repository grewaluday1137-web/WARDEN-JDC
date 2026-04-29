"""
CrisisSync — Computer Vision Engine (FastAPI)
Uses real OpenCV detectors for fire and structural collapse.
Falls back to simulation if OpenCV is unavailable.
"""

import os
import time
import random
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI(title="CrisisSync CV Engine", version="2.0.0")

# ─── CORS ──────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:3001,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# ─── Video Paths ──────────────────────────────────────────────────────────────
_DIR = os.path.dirname(os.path.abspath(__file__))
VIDEO_FIRE      = os.environ.get("CV_VIDEO_FIRE",      os.path.join(_DIR, "videos", "fire.mp4"))
VIDEO_COLLISION = os.environ.get("CV_VIDEO_COLLISION", os.path.join(_DIR, "videos", "collision.mp4"))

# ─── Load Real Detectors ──────────────────────────────────────────────────────
try:
    from detectors.fire_detector import FireDetector
    from detectors.collapse_detector import CollapseDetector
    _fire_detector     = FireDetector()
    _collapse_detector = CollapseDetector()
    CV_AVAILABLE = True
    print("[CV] Real OpenCV detectors loaded")
except ImportError:
    CV_AVAILABLE = False
    print("[CV] OpenCV not available — using simulation mode")

# ─── Request / Response Models ────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    zone_id: str
    incident_type: str

class AnalyzeResponse(BaseModel):
    zone_id: str
    confirmed: bool
    confidence: float
    detection_type: str
    signals: List[str]
    processing_time_ms: float
    engine: str  # "opencv" | "simulation"

# ─── Simulation Fallback ──────────────────────────────────────────────────────
_SIM_MAP = {
    "fire":                {"signals": ["flame_detected", "heat_signature", "smoke_plume", "color_anomaly"], "base_confidence": 0.72},
    "explosion":           {"signals": ["debris_motion", "dust_cloud", "structural_damage", "flash_detected"], "base_confidence": 0.80},
    "gas_leak":            {"signals": ["haze_detected", "air_distortion", "visibility_drop"], "base_confidence": 0.60},
    "structural_collapse": {"signals": ["falling_debris", "dust_cloud", "deformation", "motion_spike"], "base_confidence": 0.75},
}

def _simulate(incident_type: str) -> dict:
    cfg = _SIM_MAP.get(incident_type, _SIM_MAP["fire"])
    confidence = max(0.0, min(1.0, cfg["base_confidence"] + random.uniform(-0.15, 0.20)))
    confirmed  = confidence >= 0.60
    signals    = random.sample(cfg["signals"], random.randint(2, len(cfg["signals"]))) if confirmed else []
    return {"confirmed": confirmed, "confidence": round(confidence, 3), "signals": signals}

# ─── Real OpenCV Analysis (runs in thread pool to stay non-blocking) ──────────

def _run_opencv(incident_type: str) -> dict:
    """Synchronous OpenCV analysis — called via run_in_executor."""
    if incident_type == "fire" or incident_type == "explosion":
        result = _fire_detector.analyze_video(VIDEO_FIRE, max_frames=300)
        confirmed = result.get("sustained", False) or result["confidence"] >= 0.60
        return {
            "confirmed":  confirmed,
            "confidence": result["confidence"],
            "signals":    result["signals"],
        }
    elif incident_type == "structural_collapse":
        result = _collapse_detector.analyze_video(VIDEO_COLLISION, max_frames=300)
        confirmed = result["confidence"] >= 0.50
        return {
            "confirmed":  confirmed,
            "confidence": result["confidence"],
            "signals":    result["signals"],
        }
    else:
        # gas_leak — no dedicated video, use simulation
        return _simulate(incident_type)

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status":    "ok",
        "engine":    "opencv" if CV_AVAILABLE else "simulation",
        "timestamp": int(time.time() * 1000),
        "videos": {
            "fire":      os.path.exists(VIDEO_FIRE),
            "collision": os.path.exists(VIDEO_COLLISION),
        },
    }

@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_zone(req: AnalyzeRequest):
    start = time.time()

    if CV_AVAILABLE:
        loop   = asyncio.get_event_loop()
        result = await asyncio.wait_for(
            loop.run_in_executor(None, _run_opencv, req.incident_type),
            timeout=10.0
        )
        engine = "opencv"
    else:
        await asyncio.sleep(random.uniform(0.2, 0.5))
        result = _simulate(req.incident_type)
        engine = "simulation"

    return AnalyzeResponse(
        zone_id=req.zone_id,
        confirmed=result["confirmed"],
        confidence=result["confidence"],
        detection_type=req.incident_type,
        signals=result["signals"],
        processing_time_ms=round((time.time() - start) * 1000, 1),
        engine=engine,
    )

# ─── Entrypoint ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("CV_PORT", "8000"))
    print(f"[CV] CrisisSync CV Engine starting on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
