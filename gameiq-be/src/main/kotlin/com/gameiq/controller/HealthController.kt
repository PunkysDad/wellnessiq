package com.gameiq.controller

import org.springframework.web.bind.annotation.*
import org.springframework.http.ResponseEntity
import org.springframework.boot.info.BuildProperties
import org.springframework.beans.factory.annotation.Autowired
import java.time.LocalDateTime

data class HealthResponse(
    val status: String,
    val timestamp: String,
    val service: String,
    val version: String?,
    val uptime: String
)

data class SystemInfoResponse(
    val service: String,
    val version: String?,
    val environment: String,
    val timestamp: String,
    val features: List<String>,
    val database: String,
    val ai_provider: String
)

@RestController
@RequestMapping("")
@CrossOrigin(origins = ["*"]) // Allow all origins for health checks
class HealthController(
    @Autowired(required = false) private val buildProperties: BuildProperties?
) {
    
    private val startTime = LocalDateTime.now()
    
    @GetMapping("/health")
    fun health(): ResponseEntity<HealthResponse> {
        val now = LocalDateTime.now()
        val uptime = java.time.Duration.between(startTime, now)
        
        val response = HealthResponse(
            status = "UP",
            timestamp = now.toString(),
            service = "GameIQ Backend",
            version = buildProperties?.version ?: "dev",
            uptime = "${uptime.toHours()}h ${uptime.toMinutesPart()}m ${uptime.toSecondsPart()}s"
        )
        
        return ResponseEntity.ok(response)
    }
    
    @GetMapping("/info")
    fun systemInfo(): ResponseEntity<SystemInfoResponse> {
        val response = SystemInfoResponse(
            service = "GameIQ Backend API",
            version = buildProperties?.version ?: "development",
            environment = System.getenv("SPRING_PROFILES_ACTIVE") ?: "development",
            timestamp = LocalDateTime.now().toString(),
            features = listOf(
                "AI Coaching (Claude Integration)",
                "Sports IQ Quizzes", 
                "User Management",
                "Progress Tracking",
                "Social Sharing"
            ),
            database = "PostgreSQL",
            ai_provider = "Claude Sonnet 4"
        )
        
        return ResponseEntity.ok(response)
    }
    
    @GetMapping("/ping")
    fun ping(): ResponseEntity<Map<String, Any>> {
        return ResponseEntity.ok(mapOf(
            "message" to "pong",
            "timestamp" to LocalDateTime.now().toString(),
            "service" to "GameIQ Backend"
        ))
    }
    
    @GetMapping("/version")
    fun version(): ResponseEntity<Map<String, String>> {
        return ResponseEntity.ok(mapOf(
            "version" to (buildProperties?.version ?: "development"),
            "buildTime" to (buildProperties?.time?.toString() ?: "unknown"),
            "service" to "GameIQ Backend API"
        ))
    }
}