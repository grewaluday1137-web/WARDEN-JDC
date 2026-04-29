"""
CrisisSync — Collapse Detector
Real OpenCV structural collapse detection using motion, debris tracking,
dust cloud analysis, and structural edge deformation.
"""

import cv2
import numpy as np
from collections import deque


class CollapseDetector:
    def __init__(self):
        self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(history=500, varThreshold=50, detectShadows=True)
        self.morph_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        self.history_size = 30
        self.edge_history = deque(maxlen=self.history_size)
        self.blur_history = deque(maxlen=self.history_size)
        self.baseline_gray = None
        self.tracked_objects = {}
        self.object_counter = 0

    def _distance(self, pt1, pt2) -> float:
        return float(np.linalg.norm(np.array(pt1) - np.array(pt2)))

    def process_frame(self, frame: np.ndarray) -> dict:
        frame = cv2.resize(frame, (640, 480))
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        if self.baseline_gray is None:
            self.baseline_gray = blurred.copy().astype("float")
            return {"collapse_detected": False, "confidence": 0.0, "signals": []}

        cv2.accumulateWeighted(blurred, self.baseline_gray, 0.01)

        signals = []
        confidence = 0.0

        # 1. Motion detection
        fg_mask = self.bg_subtractor.apply(blurred)
        _, fg_thresh = cv2.threshold(fg_mask, 200, 255, cv2.THRESH_BINARY)
        fg_thresh = cv2.morphologyEx(fg_thresh, cv2.MORPH_OPEN, self.morph_kernel)
        fg_thresh = cv2.dilate(fg_thresh, None, iterations=2)

        motion_ratio = cv2.countNonZero(fg_thresh) / (fg_thresh.shape[0] * fg_thresh.shape[1])
        if motion_ratio > 0.05:
            signals.append("motion")
            confidence += min(motion_ratio * 5, 0.4)

        # 2. Debris / falling object detection
        contours, _ = cv2.findContours(fg_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        current_centroids = []
        falling_detected = False

        for c in contours:
            if cv2.contourArea(c) < 500:
                continue
            x, y, w, h = cv2.boundingRect(c)
            cx, cy = x + w // 2, y + h // 2
            current_centroids.append((cx, cy))

            matched_id = -1
            min_dist = float("inf")
            for obj_id, history in self.tracked_objects.items():
                if history:
                    dist = self._distance((cx, cy), history[-1][:2])
                    if dist < 150 and dist < min_dist:
                        min_dist = dist
                        matched_id = obj_id

            if matched_id != -1:
                self.tracked_objects[matched_id].append((cx, cy))
                if len(self.tracked_objects[matched_id]) > 10:
                    self.tracked_objects[matched_id].pop(0)
                total_dy = cy - self.tracked_objects[matched_id][0][1]
                if total_dy > 50:
                    falling_detected = True
            else:
                self.tracked_objects[self.object_counter] = [(cx, cy)]
                self.object_counter += 1

        # Clean stale tracks
        active_ids = set()
        for c in current_centroids:
            for obj_id, history in self.tracked_objects.items():
                if history and self._distance(c, history[-1][:2]) < 150:
                    active_ids.add(obj_id)
        self.tracked_objects = {k: v for k, v in self.tracked_objects.items() if k in active_ids}

        if falling_detected:
            signals.append("debris")
            confidence += 0.3

        # 3. Dust / smoke cloud detection
        current_blur = cv2.Laplacian(blurred, cv2.CV_64F).var()
        self.blur_history.append(current_blur)
        if len(self.blur_history) == self.history_size:
            blur_list = list(self.blur_history)
            recent_blur = np.mean(blur_list[-5:])
            past_blur = np.mean(blur_list[:5])
            if past_blur > 0 and (recent_blur / past_blur) < 0.6 and motion_ratio > 0.1:
                signals.append("dust")
                confidence += 0.2

        # 4. Structural edge deformation
        edges_current = cv2.Canny(blurred, 50, 150)
        edges_baseline = cv2.Canny(cv2.convertScaleAbs(self.baseline_gray), 50, 150)
        edge_change = cv2.countNonZero(cv2.absdiff(edges_baseline, edges_current))
        edge_change_ratio = edge_change / (blurred.shape[0] * blurred.shape[1])
        self.edge_history.append(edge_change_ratio)
        if len(self.edge_history) == self.history_size:
            if np.mean(list(self.edge_history)[-5:]) > 0.15:
                signals.append("deformation")
                confidence += 0.3

        confidence = min(confidence, 1.0)

        return {
            "collapse_detected": confidence >= 0.5,
            "confidence": round(confidence, 3),
            "signals": signals,
        }

    def analyze_video(self, video_path: str, max_frames: int = 300) -> dict:
        """Scan up to max_frames from a video and return the peak detection result. Headless."""
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {"collapse_detected": False, "confidence": 0.0, "signals": [],
                    "error": f"Cannot open {video_path}"}

        best = {"collapse_detected": False, "confidence": 0.0, "signals": []}
        frame_count = 0

        try:
            while frame_count < max_frames:
                ret, frame = cap.read()
                if not ret:
                    break
                frame_count += 1
                result = self.process_frame(frame)
                if result["confidence"] > best["confidence"]:
                    best = result
        finally:
            cap.release()

        return best
