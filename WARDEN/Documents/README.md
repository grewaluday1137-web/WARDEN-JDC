# WARDEN: Wireless Advanced Response & Deployment Network

![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)
![Simulation](https://img.shields.io/badge/Simulation-Node.js-339933?style=for-the-badge&logo=node.js)
![Desktop](https://img.shields.io/badge/Desktop-Tauri%20%2F%20React-005762?style=for-the-badge&logo=tauri)
![Mobile](https://img.shields.io/badge/Mobile-Android%20%2F%20Kotlin-3DDC84?style=for-the-badge&logo=android)
![AI](https://img.shields.io/badge/AI-Gemini%20%2F%20Gemma-4285F4?style=for-the-badge&logo=google-gemini)

WARDEN is a next-generation crisis management platform designed for high-stakes building safety and tactical response. It provides real-time awareness through a multi-component ecosystem.

## 🏗️ System Architecture


The WARDEN ecosystem consists of five core pillars, fully audited and optimized for reliability:

1.  **Backend (FastAPI)**: The central intelligence hub. It manages real-time state synchronization via WebSockets, AI reasoning relays, and historical alert logging.
2.  **Simulation Engine (Node.js/Turborepo)**: A high-fidelity multi-floor crisis simulator. It models physics (fire, smoke, heat) and occupant behavior (evacuation, BLE tracking).
3.  **Staff Desktop App (Tauri/React)**: The "Command & Control" dashboard. Features high-performance map rendering, tactical AI insights (local Gemma), and building-wide broadcast capabilities.
4.  **Responder Desktop App (Tauri/React)**: The field tactical unit dashboard. Optimized for rapid incident resolution, reporting, and localized AI assistance.
5.  **Warden Android App (Kotlin/Compose)**: The mobile field interface for guests and first responders. Features one-touch SOS, emergency indoor navigation, and direct chat with WARDEN Intel.

## 🚀 Key Features

- **Real-Time Digital Twin**: Multi-floor visualization of building status with <50ms alert propagation latency.
- **Hybrid AI Reasoning**: Uses Google Gemini for high-level tactical analysis and local Gemma-2b sidecars for offline-ready field intelligence.
- **Dynamic Evacuation**: AI-generated safe paths that automatically avoid high-risk zones and fire epicenters.
- **Unified ICS Task Board**: Integrated command structure for cross-unit coordination during active incidents.

## 🛠️ Audit Achievements (April 2026)

- ✅ **Standardized AI Sidecars**: Resolved Windows DLL loading issues for local Llama servers.
- ✅ **Build Stability**: Fixed all TypeScript and dependency bottlenecks across the monorepo.
- ✅ **Concurrent Networking**: Optimized WebSocket broadcasting to handle high-throughput simulation data.
- ✅ **Mobile SOS Integration**: Implemented high-urgency SOS endpoints with mobile-first networking reliability.

## 📖 Getting Started

Refer to the individual component directories for setup instructions:
- `/Backend` - Python 3.10+
- `/Simulation` - Node 18+ (Turborepo)
- `/Staff Desktop App` - Rust/Tauri & React
- `/Responder Desktop App` - Rust/Tauri & React
- `/Warden Android App` - Android SDK 34+

---
*WARDEN: Intelligence in Crisis.*
