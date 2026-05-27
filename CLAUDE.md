# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A sterile-interaction platform for surgical environments: surgeons control a medical viewer (PDFs, 3D models, video) hands-free using hand gestures captured by MediaPipe in the browser. Gestures flow through a backend event pipeline into session and notification services.

## Build Commands

**Shared module must be installed first — every service depends on it:**
```
mvn install -f shared/surgical-shared-events/pom.xml -DskipTests
```

**Build all backend services:**
```
mvn install -DskipTests
```

**Build a single service:**
```
mvn package -f backend/<service-name>/pom.xml -DskipTests
```

**Run tests for a single service:**
```
mvn test -f backend/<service-name>/pom.xml
```

**Start infra only (RabbitMQ):**
```
docker compose -f docker-compose.infra.yml up
```

**Build and start all services with infra:**
```
docker compose up --build
```

## Service Ports

| Service | Port |
|---|---|
| gesture-service | 8082 |
| orchestrator-service | 8083 |
| session-service | 8084 |
| notifier-service | 8085 |
| resource-service | 8086 |

RabbitMQ management UI: http://localhost:15672 (guest/guest)

## Architecture

### Event Flow

```
Browser (MediaPipe) ──POST /api/gestures──► gesture-service
                                                │
                                     [surgical.events / gesture.detected]
                                                │
                                        orchestrator-service
                                        (confidence filter ≥0.6, gesture→command mapping)
                                                │
                              [surgical.events / command.interaction]
                                        ┌───────┴───────┐
                                 session-service    notifier-service
                                 (state + DB)       (in-memory store, 50 max)
                                        │
                              [surgical.events / session.changed]
```

All services share a single RabbitMQ topic exchange `surgical.events`. Each subscribing service declares its own durable queue and binding.

### shared module (`surgical-shared-events`)

The single source of truth for cross-service contracts. All events are Java **records** implementing `Serializable`. Never duplicate event/enum definitions in individual services. Key types:
- Events: `GestureDetectedEvent`, `InteractionCommandEvent`, `SessionChangedEvent`, `AnnotationCreatedEvent`, `TranscriptionCompletedEvent`, `ViewerCommandEvent`
- Enums: `GestureType`, `InteractionCommandType`, `SessionStatus`, `ViewerType`, `ResourceType`
- DTO: `SessionContextDTO` (passed over the REST API and via events)

### Backend services

Each service follows the same internal structure: `config/RabbitConfig.java` (exchange + queue declarations), `service/` interface + `service/impl/` implementation, `listener/` for AMQP consumers, `controller/` for REST.

**gesture-service** — stateless HTTP entry point. Validates and wraps a raw gesture into a `GestureDetectedEvent`, publishes it, and returns immediately.

**orchestrator-service** — pure event transformer. Drops gestures with confidence < threshold (configurable via `orchestrator.gesture.confidence-threshold`, default 0.6) and maps `GestureType` → `InteractionCommandType` via `GestureCommandMapper` (a plain switch, no Spring bean).

**session-service** — the only stateful backend service. Stores `SessionState` in H2 (in-memory; see note below). Exposes a REST API at `/api/sessions/{sessionId}` and also consumes `command.interaction` events to apply state transitions. LOCKED sessions reject all commands except LOCK (toggle).

**notifier-service** — listens for `InteractionCommandEvent`, converts to human-readable `NotificationMessage`, stores the last 50 in a `ConcurrentLinkedDeque`. The `pushToFrontend` method is a stub — WebSocket delivery is not yet wired (see `WebSocketConfig` + inject `SimpMessagingTemplate` to activate it).

**resource-service** — no RabbitMQ. Serves a static catalog of medical resources (PDFs, videos, 3D models) pre-loaded by `DataInitializer` into an in-memory repository.

**annotation-service, speech-service, api-gateway** — skeletal stubs, not yet implemented.

### Frontend (`frontend/web-client/`)

Vanilla JS ES modules, no build step or bundler. Served directly from the filesystem or a static server.

- **MediaPipe Hands** runs entirely in-browser; gesture detection never touches the backend directly (the backend gesture API is for testing/integration).
- Entry point for the main surgical viewer: `src/js/main.js` (3-column layout: scroll rail | PDF/3D canvas | controls).
- `src/js/config.js` centralizes all tuning constants (thresholds, cooldowns, frame counts, zoom levels). Sensitive values (Azure Speech key) go in `src/js/config.local.js` (not committed).
- `src/js/handlers/results.js` → `onResults()` is the MediaPipe callback; it orchestrates gesture detection, interaction processing, and canvas rendering every frame.
- Pages: `dashboard.html` (tile navigation), `index.html` (history), `viewer3d.html` (3D model), `surgical_plan.html`, `live_feed.html`.

## Important Notes

- **H2 session data is lost on service restart.** The `application.properties` comment says to swap to PostgreSQL for production — ddl-auto is `create-drop`.
- **`surgical-shared-events` must be in the local Maven repo** before any service can compile. In CI or fresh checkouts, always run `mvn install -f shared/surgical-shared-events/pom.xml -DskipTests` first.
- **Dockerfiles build from the repo root** (not from the service directory). The build context is always `.` and the Dockerfile path is passed via `dockerfile:` in docker-compose.
- **WebSocket push is not yet active** in notifier-service — `pushToFrontend` only logs.
- The `config.local.js` file is gitignored. To use Azure Speech-to-Text, create it at `frontend/web-client/src/js/config.local.js` with `export const LOCAL_CONFIG = { AZURE_SPEECH: { SUBSCRIPTION_KEY: "...", REGION: "..." } }`.
