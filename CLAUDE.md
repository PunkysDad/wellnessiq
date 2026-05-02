# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace layout

This directory is a **workspace containing two independent git repositories**, not a monorepo. There is no top-level git repo, package manager, or build tool here — `git`, `npm`, and `gradle` commands must be run from inside one of the subdirectories.

- **`athlete-performance-app/`** — React Native (Expo) frontend. App is branded "SportsIQ" but its package id is `com.justinbooth.gameiq`. See `athlete-performance-app/CLAUDE.md` for commands and architecture.
- **`gameiq-be/`** — Kotlin / Spring Boot 3 backend (GameIQ). Provides the REST API the frontend calls. See `gameiq-be/CLAUDE.md` for commands and architecture.

When the user asks for a change, first identify which repo it belongs to and `cd` into it; defer to that repo's own CLAUDE.md for build/test/run commands.

## How the two projects connect

- **API contract:** Frontend services in `athlete-performance-app/src/services/` call the backend at `EXPO_PUBLIC_API_URL`. Backend exposes endpoints under `/api/v1` (set via Spring's `server.servlet.context-path`). Response envelope is `{ success, data?, error?, cost? }`.
- **Auth:** Firebase UID is the shared user identity. Frontend authenticates via Firebase (Apple Sign-In or `dev@gameiq.com` dev fallback); backend trusts the Firebase UID at the controller/service layer (Spring Security auto-config is disabled in the dev profile).
- **Subscriptions:** RevenueCat tiers (TRIAL / BASIC / PREMIUM) on the client; the backend enforces them via `ClaudeService` rate limits and cost budgets, and signals exhaustion with a trial/subscription-limit error message that the frontend converts into a `TrialLimitError` and shows in `TrialLimitModal`.
- **Claude API:** Only the backend talks to Anthropic. Frontend never holds `CLAUDE_API_KEY`.
- **Shared env vars:** `CLAUDE_API_KEY`, `JWT_SECRET`, and Postgres credentials (`athlete_performance_db` / `athlete_user`) appear in both `.env` templates and must agree when running the two together.

## Running both together

The two repos can run in tandem via Docker, but the compose files are **separate and partially overlapping** — don't run both at once without checking ports:

- `gameiq-be/docker-compose.yml` runs Postgres + backend (Postgres on host port 5432).
- `athlete-performance-app/docker-compose.yml` defines its own Postgres + backend + frontend services. Note: its `backend` service has `context: ./backend`, which doesn't exist in this layout — that service is stale; use `gameiq-be/`'s compose for the backend instead, and run only the `frontend` (and optionally `postgres`) service from the frontend compose.

For local dev, the typical flow is: start Postgres + backend from `gameiq-be/` (`docker-compose up` or `./gradlew bootRun`), then start Expo from `athlete-performance-app/` (`npx expo start`) pointed at `http://localhost:8080` via `EXPO_PUBLIC_API_URL`.

## Cross-repo change checklist

When a change touches the API surface (new endpoint, request/response shape, error code, subscription-limit message), update both sides in the same session:

1. Backend: controller + `ServiceDataClasses.kt` DTO + (if persisted) Flyway migration in `gameiq-be/src/main/resources/db/migration/`. The production baseline is `V20`; add new migrations after it.
2. Frontend: matching call site in `athlete-performance-app/src/services/` and any screen that reads the new field.
3. If the change introduces a new trial/subscription limit string, make sure the frontend's `TrialLimitError` detection still matches the backend wording.
