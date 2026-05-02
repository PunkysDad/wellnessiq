# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM amazoncorretto:17-alpine AS builder

WORKDIR /app

RUN apk add --no-cache curl

COPY gradle gradle
COPY gradlew .
COPY build.gradle.kts .
COPY settings.gradle.kts .
COPY src src

RUN chmod +x gradlew

RUN ./gradlew build --no-daemon -x test --no-build-cache

# ── Stage 2: Run ──────────────────────────────────────────────────────────────
FROM amazoncorretto:17-alpine

WORKDIR /app

RUN apk add --no-cache curl

# Copy only the built JAR — no Gradle, no source
COPY --from=builder /app/build/libs/gameiq-backend-1.0.0-SNAPSHOT.jar app.jar

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/api/v1/actuator/health || exit 1

# Run with prod profile — all config comes from environment variables
ENTRYPOINT ["java", "-jar", "-Dspring.profiles.active=prod", "app.jar"]