# Technical Requirements Document (TRD)
**Product Name:** WARDEN (Wireless Advanced Response & Deployment Network)
**Document Version:** 1.0
**Date:** June 2026

---

## 1. System Overview
This Technical Requirements Document (TRD) outlines the underlying technology stack, security practices, authentication mechanisms, and data persistence layers for the WARDEN ecosystem. 

## 2. Technology Stack
The WARDEN ecosystem relies on a distributed, microservice-like architecture spanning across cloud and edge compute environments.

### 2.1 Backend Services
*   **Language & Framework:** Python 3.11+, FastAPI.
*   **Networking:** High-concurrency WebSockets for real-time state synchronization (<50ms latency) and standard REST APIs.
*   **AI Integrations:** Google Gemini API (Cloud) and Vector DB integrations for RAG-based intelligence.

### 2.2 Simulation Engine
*   **Language & Environment:** Node.js (v18/v20), TypeScript.
*   **Architecture:** Turborepo-based monorepo managing individual `apps` and `packages`.
*   **Purpose:** High-fidelity simulation of physics (fire, smoke) and occupant behavior based on real-time data ingestion.

### 2.3 Desktop Applications (Staff & Responder)
*   **Framework:** Tauri (Rust backend, React frontend).
*   **AI Sidecars:** Local execution of Llama/Gemma-2b models for completely offline-ready tactical intelligence without relying on external APIs.

### 2.4 Mobile Application
*   **Platform:** Android (SDK 34+).
*   **Language & UI:** Kotlin, Jetpack Compose.
*   **Features:** SOS broadcasting, BLE/Wi-Fi based emergency indoor navigation, real-time chat.

### 2.5 Public Website
*   **Framework:** React 19, Vite, Tailwind CSS 4.
*   **Purpose:** Serves as the public-facing landing page for the WARDEN ecosystem, providing system documentation, app download links, and general information.

## 3. Databases Used
WARDEN relies on a hybrid database approach to support both real-time syncing and AI-driven spatial data.

*   **Firebase / Firestore:** Serves as the primary operational database and real-time state engine. It handles user profiles, active incident tracking, and synchronizes the Unified ICS Task Board across mobile and desktop clients.
*   **Vector Database (`vectorDB_service.py`):** Utilized by the backend to store and rapidly query high-dimensional embeddings for the AI reasoning relay. This allows the system to quickly cross-reference historical incident logs and floor plan embeddings to feed context to Google Gemini and local Gemma models.

## 4. Authentication Mechanism
Authentication within WARDEN operates on a zero-trust model utilizing JSON Web Tokens (JWT).

*   **JWT Generation & Validation:**
    *   The Python/FastAPI backend generates standard JWTs when users (Staff or Responders) authenticate.
    *   Tokens are signed using a symmetric encryption secret (`SECRET_KEY`), utilizing the **HS256** hashing algorithm.
*   **Session Management:** 
    *   These JWTs are passed as Bearer tokens in the `Authorization` header for all REST calls, and integrated into the WebSocket handshake process to ensure only authorized endpoints can receive real-time telemetry or alert streams.
*   **Firebase Auth (Supplementary):** For systems directly interacting with Firebase (like the Android App), standard Firebase Authentication protocols are layered in to securely identify users and devices.

## 5. API Keys & Secrets Management
API keys are strictly managed to avoid hardcoding sensitive credentials into the application source code.

*   **Local & Deployment Configuration (`.env`):**
    *   Keys are injected via a `.env` file at the root of the backend server. This file is explicitly `.gitignore`d.
*   **Google Gemini API Key (`GEMINI_API_KEY`):**
    *   Required by the backend to securely communicate with Google's Cloud AI endpoints. The backend acts as a secure relay, meaning client apps never possess this key directly.
*   **Firebase Service Account Key (`firebase_key.json`):**
    *   The backend establishes a secure administrative connection to the Firebase project by reading a local `firebase_key.json` file. The path to this file is dictated by the `FIREBASE_KEY_PATH` environment variable.
*   **SMTP Credentials:**
    *   Used for outbound system alerts via email. Uses application-specific passwords (e.g., Gmail App Passwords) rather than primary user credentials.
