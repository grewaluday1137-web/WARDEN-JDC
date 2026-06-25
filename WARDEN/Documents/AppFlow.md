# WARDEN Application Flow & Working Model

**Product Name:** WARDEN (Wireless Advanced Response & Deployment Network)
**Document Version:** 1.0
**Date:** June 2026

---

## 1. Introduction
This document outlines the core application flow of the WARDEN ecosystem. It details how data moves between the mobile clients, simulation engine, backend, and command dashboards, defining the lifecycle of an emergency from initial detection to resolution.

## 2. High-Level Architecture Flow
The WARDEN ecosystem operates on a highly synchronized feedback loop involving five main nodes:
1. **Sensors / Mobile Clients (Android):** The origin point for human-triggered alerts (SOS) and localized environmental data.
2. **Simulation Engine (Node.js):** Generates real-time virtual models of the building, processing physics (e.g., fire/smoke spread) and tracking occupant density via BLE/Wi-Fi.
3. **Backend Hub (FastAPI):** Acts as the central nervous system. It orchestrates real-time WebSocket communication, authenticates clients, and routes data to AI endpoints.
4. **Hybrid AI Engine (Gemini & Gemma):** Processes incoming emergency telemetry to provide predictive analysis, dynamic routing, and tactical recommendations.
5. **Command Interfaces (Staff & Responder Desktop Apps):** The termination points for data consumption and the origin points for tactical command execution.

---

## 3. Core Working Flows

### 3.1 Steady State (Normal Operation)
*   **Occupant Tracking:** The Simulation Engine continuously ingests generalized building telemetry (Wi-Fi access point loads, BLE beacons) to model a digital twin of occupant density.
*   **Client Connections:** Staff and Responder Desktop Apps maintain persistent, authenticated WebSocket connections with the FastAPI backend.
*   **System Readiness:** Local AI sidecars (Gemma-2b) are pre-loaded in memory on the desktop apps, ready for immediate, offline tactical queries.

### 3.2 Emergency Trigger & Ingestion Flow
An emergency can be triggered in two primary ways:
*   **Manual Trigger (Mobile App SOS):** 
    1. A guest or responder hits the "SOS" panic button on the Warden Android App.
    2. The app sends a high-priority REST/WebSocket payload containing precise geolocation and floor data to the Backend.
*   **Automated Trigger (Sensor/Simulation):** 
    1. The Simulation Engine detects an anomaly (e.g., rapid heat increase or simulated fire spread).
    2. An event payload is pushed directly to the Backend hub.

### 3.3 AI Processing & Dynamic Routing
1.  **Contextualization:** The Backend queries the **Vector DB** using the incident parameters to fetch relevant historical protocols, floor plan embeddings, and hazard classifications.
2.  **Strategic Analysis:** The Backend relays this package to **Google Gemini (Cloud AI)** to generate a high-level strategic overview (e.g., "Fire on Floor 3; evacuate Sector B immediately").
3.  **Pathfinding Generation:** The Simulation Engine and Backend calculate a dynamic evacuation route that avoids the active hazard zones.
4.  **Broadcast:** The Backend blasts the newly calculated safe routes and the strategic AI summary to all connected clients within <50ms.

### 3.4 Execution & Response Flow (Command & Control)
1.  **Staff Desktop App (Command Center):** 
    *   The digital twin immediately visualizes the hazard and the updated occupant density.
    *   Command staff use the **Unified ICS Task Board** to dispatch specific tactical units.
    *   Staff can broadcast building-wide emergency alerts or safe-route updates to all Mobile Clients.
2.  **Responder Desktop App (Field Units):** 
    *   Field teams receive ICS tasks on their dashboard.
    *   If network connectivity drops in the building, responders seamlessly fail over to their **local Gemma-2b AI sidecars** for continued tactical advice and protocol retrieval without needing the FastAPI backend.
3.  **Mobile App (Occupants):** 
    *   Receives push notifications with the newly calculated, safe evacuation routes.
    *   Users can use the real-time secure chat to communicate their status directly to Command Staff.

### 3.5 Incident Resolution
1.  Command staff mark the incident as resolved via the ICS Task Board.
2.  The Backend logs the full incident timeline, AI reasoning steps, and response metrics into **Firebase / Firestore**.
3.  The system transitions back to Steady State.
