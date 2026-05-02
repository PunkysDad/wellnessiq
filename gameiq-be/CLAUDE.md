# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GameIQ is a sports coaching and training platform backend. It provides AI-powered workout generation, quiz sessions, and coaching conversations using the Claude API. Users authenticate via Firebase, have subscription tiers (TRIAL, NONE, BASIC, PREMIUM), and interact with sport/position-specific content across football, basketball, baseball, soccer, and hockey.

## Tech Stack

- **Language:** Kotlin 1.9 on JVM 17
- **Framework:** Spring Boot 3.1.5 (Web, JPA, Security, WebFlux, Actuator, Validation)
- **Database:** PostgreSQL 15 with Flyway migrations
- **Auth:** Firebase UID-based (security auto-config disabled in dev profile)
- **AI Integration:** Claude API via direct REST calls (RestTemplate)
- **Rate Limiting:** Bucket4j for in-memory rate limiting; subscription-tier-based cost budgets in ClaudeService
- **Build:** Gradle (Kotlin DSL)

## Common Commands

```bash
# Build (skip tests)
./gradlew build -x test

# Run tests
./gradlew test

# Run a single test class
./gradlew test --tests "com.gameiq.controller.UserControllerTest"

# Run a single test method
./gradlew test --tests "com.gameiq.controller.UserControllerTest.testMethodName"

# Start with Docker (Postgres + backend)
docker-compose up

# Start just Postgres for local dev
docker-compose up postgres

# Run locally (requires Postgres running)
./gradlew bootRun
```

## Architecture

All source code lives under `src/main/kotlin/com/gameiq/` with a flat package structure (no subpackage nesting beyond the layer):

- **`entity/`** — JPA entities and enums (Sport, Position, SubscriptionTier, ConversationType, etc.). `User.kt` defines the core domain enums.
- **`repository/`** — Spring Data JPA repositories.
- **`service/`** — Business logic. `ClaudeService` handles all Claude API calls (chat, workouts, quizzes) with rate limiting and cost tracking. `ServiceDataClasses.kt` contains all DTOs and request/response types.
- **`controller/`** — REST controllers. All endpoints are prefixed with `/api/v1` (set via `server.servlet.context-path`).
- **`SecurityConfig.kt`** — Spring Security config (all requests permitted; Firebase validation at controller/service level).
- **`GameIQApplication.kt`** — Entry point with `@EnableScheduling`, `@EnableJpaRepositories`, `@EnableTransactionManagement`.

## Key Patterns

- **Configuration:** Single `application.yml` with profile-based sections (`dev`, `prod`). Dev profile disables Spring Security auto-config entirely. Environment variables for all secrets.
- **Database migrations:** Flyway in `src/main/resources/db/migration/`. V1 is the initial schema; V20 is the production baseline. Note: V1 schema uses UUIDs and different enum types than the current JPA entities (which use IDENTITY Long IDs) — the production baseline (V20) is the authoritative schema.
- **Claude API integration:** Direct HTTP calls via RestTemplate in `ClaudeService`, not using Anthropic SDK. Conversation history is loaded from DB for multi-turn sessions.
- **Rate limiting by tier:** TRIAL users get hard limits (3 chats, 1 workout). BASIC/PREMIUM users have monthly cost budgets (400/800 cents). Tracked via `ClaudeConversation` cost records.
- **Tests:** Use JUnit 5 + Mockito (mockito-kotlin). Located in `src/test/kotlin/com/gameiq/`.

## Docker

- `Dockerfile` — Multi-stage production build (amazoncorretto:17-alpine)
- `Dockerfile.dev` — Dev build (runs via `gradlew bootRun`)
- `docker-compose.yml` — Postgres + backend. Backend expects `CLAUDE_API_KEY`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `JWT_SECRET` from environment.
