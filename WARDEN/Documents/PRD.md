# Product Requirements Document (PRD)
**Product Name:** WARDEN (Wireless Advanced Response & Deployment Network)
**Document Version:** 1.0
**Date:** June 2026

---

## 1. Executive Summary
**WARDEN** is a next-generation crisis management and tactical response platform designed for high-stakes building safety. It integrates a real-time digital twin ecosystem, multi-platform applications, and hybrid Artificial Intelligence to provide unprecedented situational awareness, rapid incident resolution, and dynamic evacuation planning during emergencies.

## 2. Product Vision & Goals
### 2.1 Vision
To revolutionize building safety and emergency response by eliminating information silos and providing intelligent, real-time insights to both occupants and first responders during a crisis.

### 2.2 Core Goals
- Reduce alert propagation and emergency response latency to under 50ms.
- Provide a unified, real-time view of building status for incident commanders.
- Deliver dynamic, AI-generated evacuation routes that continuously adapt to evolving threats.
- Maintain operational capability even under network strain via offline-ready local AI sidecars.

## 3. Target Audience & Personas
1. **Command Staff / Security Operations (Staff Desktop App):** Requires high-level visibility, building-wide broadcast capabilities, and tactical insights.
2. **First Responders / Tactical Units (Responder Desktop App):** Requires mobile-friendly, localized intelligence, rapid incident resolution tools, and offline reliability.
3. **Building Occupants / Guests (Warden Android App):** Requires intuitive SOS functionality, emergency indoor navigation, and clear communication channels.

## 4. System Architecture
WARDEN operates on a fully audited, high-reliability microservice architecture:
- **Backend (Python / FastAPI):** The central intelligence hub. Manages WebSockets for state synchronization, Firebase integration, and AI reasoning relays.
- **Simulation Engine (Node.js / Turborepo):** High-fidelity multi-floor crisis simulator modeling physics (fire, smoke, heat) and occupant behavior (BLE tracking).
- **Staff Desktop App (Rust / Tauri & React):** High-performance Command & Control dashboard featuring map rendering and local AI (Gemma) insights.
- **Responder Desktop App (Rust / Tauri & React):** Field tactical dashboard optimized for rapid deployments.
- **Mobile Client (Android / Kotlin Compose):** Mobile-first endpoint for field interactions.

## 5. Core Features & Requirements
### 5.1 Real-Time Digital Twin
- **Description:** A multi-floor 3D/2D visualization of the building's current status.
- **Requirements:** 
  - Sub-50ms latency for alert propagation across all connected clients via WebSockets.
  - Integration with the Node.js simulation engine to reflect heat, smoke, and occupant density.

### 5.2 Hybrid AI Reasoning Engine
- **Description:** Combines cloud-based heavy models with local, fast sidecars.
- **Requirements:**
  - **Cloud (Google Gemini):** Responsible for complex, high-level tactical analysis and cross-incident correlation.
  - **Edge (Gemma-2b):** Local sidecars running on desktop apps to provide offline-ready field intelligence and immediate triage recommendations.

### 5.3 Dynamic Evacuation Routing
- **Description:** Automatically generates and updates safe evacuation paths.
- **Requirements:**
  - Real-time pathfinding algorithms that avoid expanding hazard zones (e.g., fire epicenters).
  - Push notifications to the Android App to reroute occupants mid-evacuation.

### 5.4 Unified ICS (Incident Command System) Task Board
- **Description:** An integrated workflow for cross-unit coordination.
- **Requirements:**
  - Ability to assign, track, and resolve active incidents in real-time.
  - Cross-platform syncing (Mobile, Responder Desktop, Staff Desktop).

### 5.5 One-Touch SOS & Chat
- **Description:** Direct lifeline for building occupants.
- **Requirements:**
  - Panic button on the Android app sending immediate geolocation and floor data to the Command Staff.
  - Secure, real-time chat between occupants and WARDEN Intel / responders.

## 6. Non-Functional Requirements (NFRs)
- **Performance:** System must handle concurrent networking and high-throughput simulation data without degrading below 60 FPS in desktop renders.
- **Reliability:** Mobile SOS endpoints must utilize retry mechanisms and fallback protocols to guarantee message delivery.
- **Security:** Strict separation of API keys (managed via `.env` / Kubernetes Secrets, though currently running locally). JWT-based authentication (HS256) for all WebSocket and REST interactions.
- **Compatibility:** Android app requires SDK 34+; Desktop apps require modern Windows/Linux environments capable of running Tauri.

## 7. Assumptions & Dependencies
- Hardware running the Desktop apps has sufficient resources to host Gemma-2b local models.
- Building infrastructure supports BLE/Wi-Fi tracking for accurate occupant simulation and routing.
- The project runs as standalone local services, utilizing a local Firebase key for database and authentication requirements.

## 8. Future Scope & Roadmap
- Integration with external CAD (Computer-Aided Dispatch) systems used by municipal fire and police departments.
- Expansion to iOS for the mobile client.
- Implementation of AR (Augmented Reality) wayfinding in the mobile application for smoke-filled environments.
