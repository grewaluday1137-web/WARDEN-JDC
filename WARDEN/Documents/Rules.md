# WARDEN Project Rules & Guidelines

**Product Name:** WARDEN (Wireless Advanced Response & Deployment Network)
**Document Version:** 1.0
**Date:** June 2026

---

## 1. Introduction
This document outlines the strict guidelines, development rules, and operational constraints that all contributors must adhere to when working on the WARDEN ecosystem. Because WARDEN is a mission-critical life-safety application, code quality, security, and performance are non-negotiable.

## 2. Security & Credentials (CRITICAL)
*   **Rule 1: No Hardcoded Secrets.** Never commit `.env` files, `firebase_key.json`, or raw API keys (e.g., `GEMINI_API_KEY`) to version control. Always use environment variables.
*   **Rule 2: Zero-Trust Communication.** All internal and external endpoints must authenticate via JWT (HS256). WebSockets must perform a token handshake before transmitting any telemetry data.
*   **Rule 3: Local Over Cloud Defaults.** Following the removal of Kubernetes (`k8s`) deployment configs, the system is designed to run as robust local/standalone services. Avoid hard-locking the system to cloud-exclusive infrastructure where local alternatives (like local Gemma models or local networking) exist.

## 3. Performance & Networking Constraints
*   **Rule 4: The 50ms Rule.** Real-time emergency telemetry (heat maps, SOS broadcasts, path updates) must propagate from the Simulation Engine/Mobile Clients through the Backend to the Desktop displays in under 50 milliseconds.
*   **Rule 5: Offline Resilience.** Desktop Applications (Staff and Responder) MUST maintain operational capabilities if internet connectivity is lost. The local AI sidecar (Gemma-2b) must be capable of answering tactical queries locally without the FastAPI backend.
*   **Rule 6: Payload Compression.** WebSocket payloads transmitting building coordinate data must be strictly minified/compressed to preserve bandwidth in congested emergency scenarios.

## 4. Architecture & Codebase Guidelines
*   **Rule 7: Strict Separation of Concerns.**
    *   *Backend (Python/FastAPI):* Strict routing, security, and AI context relay only. No direct physical simulation logic.
    *   *Simulation Engine (Node.js):* Purely handles physics, environment changes, and generating map geometries. No user authentication management.
    *   *Clients (Tauri/Android):* Purely visualization and command inputs. 
*   **Rule 8: Monorepo Integrity.** For the Node.js Simulation component, ensure `Turborepo` boundaries are respected. `apps` should never deeply import from other `apps`; shared logic must live in the `packages` directory.
*   **Rule 9: Tactical UI/UX Enforcement.** Do not deviate from the Dark-Mode, high-contrast Tactical Modernism design language defined in `Design.md`. Critical hazards must always use the designated alert Red (`#EF4444`).

## 5. Contribution & Git Protocol
*   **Rule 10: Conventional Commits.** All commits must follow the conventional commit format (e.g., `feat: add dynamic routing`, `fix: resolve websocket memory leak`, `docs: update PRD`).
*   **Rule 11: Main Branch Protection.** The `main` branch must remain in a highly stable, deployable state at all times. Direct pushes to `main` are restricted unless addressing urgent pipeline fixes. 
*   **Rule 12: Audit & Testing Requirement.** Any changes made to the pathfinding service or AI prompt templates must pass rigorous stress testing against the Simulation Engine to ensure evacuation routes do not inadvertently guide occupants into hazard zones.
