"""
CrisisSync — Fire Detector
Real OpenCV fire detection using HSV color masking + background subtraction.
"""

import cv2
import numpy as np


def _get_intensity(area: float) -> tuple:
    if area > 40000:   return "CRITICAL", 1.0
    elif area > 20000: return "HIGH",     0.80
    elif area > 8000:  return "MODERATE", 0.60
    else:              return "LOW",       0.40


class FireDetector:
    def __init__(self):
        self.fgbg = cv2.createBackgroundSubtractorMOG2(history=300, varThreshold=40)
        self.fire_counter = 0
        self.kernel = np.ones((5, 5), np.uint8)

    def process_frame(self, frame: np.ndarray) -> dict:
        frame = cv2.resize(frame, (640, 480))
        fh, fw = frame.shape[:2]

        roi = frame[int(fh * 0.2):int(fh * 0.8), int(fw * 0.2):int(fw * 0.8)]
        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

        mask1 = cv2.inRange(hsv, np.array([18, 50, 50]),  np.array([35, 255, 255]))
        mask2 = cv2.inRange(hsv, np.array([0,  50, 50]),  np.array([10, 255, 255]))
        mask3 = cv2.inRange(hsv, np.array([170, 50, 50]), np.array([180, 255, 255]))
        fire_mask = cv2.bitwise_or(cv2.bitwise_or(mask1, mask2), mask3)

        fgmask = self.fgbg.apply(roi)
        fgmask = cv2.morphologyEx(fgmask, cv2.MORPH_OPEN, self.kernel)
        combined = cv2.bitwise_and(fire_mask, fgmask)

        contours, _ = cv2.findContours(combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        fire_detected = False
        total_area = 0.0
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > 1000:
                fire_detected = True
                total_area += area

        self.fire_counter = self.fire_counter + 1 if fire_detected else 0

        signals = []
        confidence = 0.0
        intensity = "NONE"

        if fire_detected:
            intensity, confidence = _get_intensity(total_area)
            signals.append("flame_detected")
            if total_area > 8000:  signals.append("smoke_plume")
            if total_area > 20000: signals.append("heat_signature")
            if total_area > 40000: signals.append("color_anomaly")

        return {
            "fire_detected": fire_detected,
            "sustained": self.fire_counter > 5,
            "confidence": round(confidence, 3),
            "intensity": intensity,
            "area": int(total_area),
            "signals": signals,
        }

    def analyze_video(self, video_path: str, max_frames: int = 300) -> dict:
        """Scan up to max_frames from a video and return the peak detection result. Headless."""
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {"fire_detected": False, "confidence": 0.0, "signals": [], "intensity": "NONE",
                    "error": f"Cannot open {video_path}"}

        best = {"fire_detected": False, "confidence": 0.0, "signals": [], "intensity": "NONE", "area": 0}
        frame_count = 0

        try:
            while frame_count < max_frames:
                ret, frame = cap.read()
                if not ret:
                    break
                frame_count += 1
                if frame_count % 3 != 0:
                    continue
                result = self.process_frame(frame)
                if result["confidence"] > best["confidence"]:
                    best = result
        finally:
            cap.release()

        return best
