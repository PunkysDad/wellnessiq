#!/bin/bash

# Backend Setup Script for Athlete Performance App (FIXED)
# This script creates the complete Kotlin Spring Boot backend structure

set -e  # Exit on any error

echo "🏗️  Creating Athlete Performance Backend Structure..."

# Create backend directory structure (FIXED)
echo "📁 Creating backend directory structure..."

# Create the main directory structure properly
mkdir -p backend/src/main/kotlin/com/athleteperformance/{entity,repository,service,controller,dto,security,config,exception}
mkdir -p backend/src/main/resources/{db/migration,static,templates}
mkdir -p backend/src/test/kotlin/com/athleteperformance
mkdir -p backend/gradle/wrapper
mkdir -p backend/sql/init

echo "📝 Creating backend configuration files..."

# Create build.gradle.kts
cat > backend/build.gradle.kts << 'EOF'
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    id("org.springframework.boot") version "3.1.5"
    id("io.spring.dependency-management") version "1.1.3"
    kotlin("jvm") version "1.9.10"
    kotlin("plugin.spring") version "1.9.10"
    kotlin("plugin.jpa") version "1.9.10"
}

group = "com.athleteperformance"
version = "1.0.0-SNAPSHOT"
java.sourceCompatibility = JavaVersion.VERSION_17

repositories {
    mavenCentral()
}

dependencies {
    // Spring Boot Starters
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    
    // Kotlin support
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    
    // Database
    runtimeOnly("org.postgresql:postgresql")
    implementation("org.flywaydb:flyway-core")
    
    // JWT Authentication
    implementation("io.jsonwebtoken:jjwt-api:0.11.5")
    implementation("io.jsonwebtoken:jjwt-impl:0.11.5")
    implementation("io.jsonwebtoken:jjwt-jackson:0.11.5")
    
    // HTTP Client for YouTube API
    implementation("org.springframework.boot:spring-boot-starter-webflux")
    
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-reactor")
    
    // Development tools
    developmentOnly("org.springframework.boot:spring-boot-devtools")
    
    // Testing
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
}

tasks.withType<KotlinCompile> {
    kotlinOptions {
        freeCompilerArgs = listOf("-Xjsr305=strict")
        jvmTarget = "17"
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}
EOF

# Create settings.gradle.kts
cat > backend/settings.gradle.kts << 'EOF'
rootProject.name = "athlete-performance-backend"
EOF

# Create Dockerfile.dev
cat > backend/Dockerfile.dev << 'EOF'
FROM openjdk:17-jdk-slim

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set work directory
WORKDIR /app

# Copy gradle wrapper and build files first (for better caching)
COPY gradle gradle
COPY gradlew .
COPY gradlew.bat .
COPY build.gradle.kts .
COPY settings.gradle.kts .

# Make gradlew executable
RUN chmod +x gradlew

# Download dependencies (this layer will be cached if dependencies don't change)
RUN ./gradlew dependencies --no-daemon

# Copy source code
COPY src src

# Change ownership to app user
RUN chown -R appuser:appuser /app
USER appuser

# Expose ports
EXPOSE 8080 5005

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

# Default command
CMD ["./gradlew", "bootRun", "--args=--spring.profiles.active=dev"]
EOF

# Create gradlew script
cat > backend/gradlew << 'EOF'
#!/bin/sh

# Gradle wrapper script
DEFAULT_JVM_OPTS='"-Xmx64m" "-Xms64m"'
APP_NAME="Gradle"
APP_BASE_NAME=`basename "$0"`

# Attempt to set APP_HOME
PRG="$0"
while [ -h "$PRG" ] ; do
    ls=`ls -ld "$PRG"`
    link=`expr "$ls" : '.*-> \(.*\)$'`
    if expr "$link" : '/.*' > /dev/null; then
        PRG="$link"
    else
        PRG=`dirname "$PRG"`"/$link"
    fi
done
SAVED="`pwd`"
cd "`dirname \"$PRG\"`/" >/dev/null
APP_HOME="`pwd -P`"
cd "$SAVED" >/dev/null

CLASSPATH=$APP_HOME/gradle/wrapper/gradle-wrapper.jar

exec java $DEFAULT_JVM_OPTS $JAVA_OPTS -classpath "$CLASSPATH" org.gradle.wrapper.GradleWrapperMain "$@"
EOF

chmod +x backend/gradlew

# Create application.yml
cat > backend/src/main/resources/application.yml << 'EOF'
server:
  port: 8080

spring:
  application:
    name: athlete-performance-api
  
  datasource:
    url: jdbc:postgresql://${DB_HOST:postgres}:${DB_PORT:5432}/${DB_NAME:athlete_performance_db}
    username: ${DB_USER:athlete_user}
    password: ${DB_PASSWORD:dev_password_2024}
    driver-class-name: org.postgresql.Driver
    
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: true
    database-platform: org.hibernate.dialect.PostgreSQLDialect
        
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true

app:
  youtube:
    api-key: ${YOUTUBE_API_KEY:your-youtube-api-key}
    
  claude:
    api-key: ${CLAUDE_API_KEY:your-claude-api-key}

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics

logging:
  level:
    com.athleteperformance: DEBUG
EOF

echo "🗃️  Creating database migration..."

# Create initial database migration
cat > backend/src/main/resources/db/migration/V1__Initial_Schema.sql << 'EOF'
-- Initial database schema for Athlete Performance App
-- Uses database name: athlete_performance_db (matching your existing .env)

-- User tiers enum
CREATE TYPE user_tier AS ENUM ('BASIC', 'PRO', 'ELITE');

-- User roles enum  
CREATE TYPE user_role AS ENUM ('ATHLETE', 'COACH', 'TEAMMATE');

-- Sports enum (can be extended)
CREATE TYPE sport_type AS ENUM (
    'FOOTBALL', 'BASKETBALL', 'BASEBALL', 'SOCCER', 'TENNIS', 
    'TRACK_FIELD', 'SWIMMING', 'WRESTLING', 'VOLLEYBALL', 'SOFTBALL',
    'LACROSSE', 'HOCKEY', 'GOLF', 'CROSS_COUNTRY', 'GYMNASTICS', 'OTHER'
);

-- Performance categories
CREATE TYPE performance_category AS ENUM (
    'GAME_HIGHLIGHTS', 'TRAINING', 'SKILLS_DEMO', 'DRILLS', 
    'STRENGTH_TRAINING', 'SPEED_AGILITY', 'TECHNIQUE', 'SCRIMMAGE'
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'ATHLETE',
    tier user_tier NOT NULL DEFAULT 'BASIC',
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Athlete profiles
CREATE TABLE athlete_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sport sport_type NOT NULL,
    position VARCHAR(100),
    jersey_number INTEGER,
    height_inches INTEGER,
    weight_pounds INTEGER,
    birth_date DATE,
    graduation_year INTEGER,
    school VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50) DEFAULT 'USA',
    bio TEXT,
    profile_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Videos table (YouTube references)
CREATE TABLE user_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    youtube_url VARCHAR(500) NOT NULL,
    youtube_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    sport sport_type NOT NULL,
    category performance_category NOT NULL,
    is_featured BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    date_performed DATE,
    tags TEXT[],
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews/feedback table
CREATE TABLE user_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewed_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id UUID REFERENCES user_videos(id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT no_self_review CHECK (reviewer_id != reviewed_user_id)
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_tier ON users(role, tier);
CREATE INDEX idx_athlete_profiles_sport ON athlete_profiles(sport);
CREATE INDEX idx_user_videos_user_id ON user_videos(user_id);
CREATE INDEX idx_user_videos_sport_category ON user_videos(sport, category);
CREATE INDEX idx_user_reviews_reviewed_user ON user_reviews(reviewed_user_id);

-- Seed data for development
INSERT INTO users (email, password_hash, first_name, last_name, role, tier) VALUES
('test.athlete@example.com', '$2a$10$dummy.hash.for.dev', 'Test', 'Athlete', 'ATHLETE', 'BASIC'),
('test.coach@example.com', '$2a$10$dummy.hash.for.dev', 'Test', 'Coach', 'COACH', 'PRO');

-- Sample athlete profile
INSERT INTO athlete_profiles (
    user_id, sport, position, jersey_number, height_inches, weight_pounds, 
    birth_date, graduation_year, school, city, state, bio
) VALUES (
    (SELECT id FROM users WHERE email = 'test.athlete@example.com'),
    'FOOTBALL', 'Quarterback', 12, 72, 185, '2006-03-15', 2024,
    'Test High School', 'Nashville', 'TN', 
    'Dedicated quarterback with strong arm and field vision. Team captain for two years.'
);
EOF

echo "📄 Creating main application class..."

# Create main application class
cat > backend/src/main/kotlin/com/athleteperformance/AthletePerformanceApplication.kt << 'EOF'
package com.athleteperformance

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.transaction.annotation.EnableTransactionManagement

@SpringBootApplication
@EnableJpaRepositories
@EnableTransactionManagement
class AthletePerformanceApplication

fun main(args: Array<String>) {
    runApplication<AthletePerformanceApplication>(*args)
}
EOF

echo "📋 Backend environment variables needed (add to your existing .env)..."

# Create .env additions template (don't overwrite existing)
cat > .env.backend.template << 'EOF'
# Add these to your existing .env file for backend support

# YouTube Data API Key (get from Google Cloud Console)
YOUTUBE_API_KEY=your_youtube_api_key_here

# Claude API Key (get from Anthropic Console)  
CLAUDE_API_KEY=your_claude_api_key_here

# JWT Secret (generate a secure random string)
JWT_SECRET=your_jwt_secret_key_here_make_it_long_and_secure

# Your existing database settings should work:
# DB_HOST=postgres
# DB_PORT=5432  
# DB_NAME=athlete_performance_db
# DB_USER=athlete_user
# DB_PASSWORD=dev_password_2024
EOF

echo "🐳 Updating docker-compose.yml for backend support..."

# Update docker-compose.yml to include backend services
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: athlete-postgres
    environment:
      POSTGRES_DB: athlete_performance_db
      POSTGRES_USER: athlete_user
      POSTGRES_PASSWORD: dev_password_2024
      POSTGRES_HOST_AUTH_METHOD: trust
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - athlete-network

  # Kotlin Spring Boot Backend
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    container_name: athlete-backend
    ports:
      - "8080:8080"
      - "5005:5005"  # Debug port
    environment:
      - SPRING_PROFILES_ACTIVE=dev
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=athlete_performance_db
      - DB_USER=athlete_user
      - DB_PASSWORD=dev_password_2024
      - YOUTUBE_API_KEY=${YOUTUBE_API_KEY}
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
    volumes:
      - ./backend:/app
      - gradle_cache:/home/gradle/.gradle
    depends_on:
      - postgres
    networks:
      - athlete-network

  # React Native App (existing)
  frontend:
    build: 
      context: ./frontend
      dockerfile: Dockerfile.dev
    container_name: athlete-frontend
    ports:
      - "19000:19000"
      - "19001:19001"
      - "8081:8081"
    volumes:
      - ./frontend:/app
      - node_modules:/app/node_modules
    networks:
      - athlete-network

  # Database Admin (optional - for development)
  pgadmin:
    image: dpage/pgadmin4:7
    container_name: athlete-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: dev@athlete.com
      PGADMIN_DEFAULT_PASSWORD: dev123
      PGADMIN_CONFIG_SERVER_MODE: 'False'
    ports:
      - "5050:80"
    depends_on:
      - postgres
    networks:
      - athlete-network

volumes:
  postgres_data:
  gradle_cache:
  node_modules:

networks:
  athlete-network:
    driver: bridge
EOF

echo "✅ Backend structure created successfully!"
echo
echo "📋 Next Steps:"
echo "1. Add backend environment variables to your existing .env file:"
echo "   cat .env.backend.template >> .env"
echo "2. Edit .env to add your YouTube API key and other secrets"
echo "3. Run: docker-compose up postgres backend"
echo "4. Test the API at http://localhost:8080/actuator/health"
echo "5. Optional: Access PgAdmin at http://localhost:5050"
echo
echo "🚀 Your existing frontend .env will work with the backend!"