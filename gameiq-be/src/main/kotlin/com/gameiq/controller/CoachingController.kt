package com.gameiq.controller

import com.gameiq.service.ClaudeService
import com.gameiq.entity.*
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.client.RestTemplate

data class CoachingSituationRequest(
    val sport: String,
    val situation: Map<String, String>,
    val sessionId: String? = null
)

data class CoachingAnalysisResponse(
    val sport: String,
    val situation: String,
    val recommendation: String,
    val reasoning: List<String>,
    val timestamp: String,
    val conversationId: Long,
    val sessionId: String,
    val suggestWorkout: Boolean = false,
    val workoutFocusSummary: String? = null
)

@RestController
@RequestMapping("/coaching")
@CrossOrigin(origins = ["http://localhost:3000", "http://localhost:19006"])
class CoachingController(
    private val claudeService: ClaudeService,
    private val restTemplate: RestTemplate = RestTemplate()
) {

    @Value("\${claude.api.key}")
    private lateinit var claudeApiKey: String

    @Value("\${claude.api.url:https://api.anthropic.com/v1/messages}")
    private lateinit var claudeApiUrl: String

    private val haikuModel = "claude-haiku-4-5-20251001"

    private val logger = LoggerFactory.getLogger(CoachingController::class.java)

    @PostMapping("/analyze")
    fun analyzeCoachingSituation(
        @RequestBody request: CoachingSituationRequest,
        @RequestParam userId: Long
    ): ResponseEntity<Any> {
        return try {
            val sportInput = request.sport.uppercase()
            val isGeneralFitness = sportInput == "GENERAL_FITNESS"

            val sport = if (isGeneralFitness) Sport.GENERAL_FITNESS else Sport.valueOf(sportInput)
            val conversationType = if (isGeneralFitness) {
                ConversationType.GENERAL_SPORTS_QUESTION
            } else {
                ConversationType.GAME_STRATEGY
            }

            val situationDescription = request.situation.entries.joinToString(", ") { "${it.key}: ${it.value}" }
            val coachingMessage = "Analyze this ${sport.name} situation: $situationDescription. Provide strategic recommendation."

            val conversation = claudeService.chatWithClaude(
                userId = userId,
                message = coachingMessage,
                sessionId = request.sessionId,
                sport = sport,
                conversationType = conversationType
            )

            val suggestWorkout = conversation.claudeResponse.contains(
                "Would you like me to create a workout plan to work towards these goals?",
                ignoreCase = true
            )

            val workoutFocusSummary = if (suggestWorkout) {
                generateWorkoutFocusSummary(conversation.claudeResponse)
            } else {
                null
            }

            ResponseEntity.ok(
                CoachingAnalysisResponse(
                    sport = sport.name,
                    situation = situationDescription,
                    recommendation = conversation.claudeResponse,
                    reasoning = listOf("Analysis based on historical data and strategic principles"),
                    timestamp = conversation.createdAt.toString(),
                    conversationId = conversation.id,
                    sessionId = conversation.sessionId,
                    suggestWorkout = suggestWorkout,
                    workoutFocusSummary = workoutFocusSummary
                )
            )
        } catch (e: IllegalStateException) {
            ResponseEntity.badRequest().body(
                mapOf("message" to (e.message ?: "Subscription limit reached."))
            )
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(
                mapOf("message" to (e.message ?: "Failed to analyze coaching situation."))
            )
        }
    }

    private fun generateWorkoutFocusSummary(coachingResponse: String): String? {
        return try {
            val headers = HttpHeaders().apply {
                set("x-api-key", claudeApiKey)
                set("anthropic-version", "2023-06-01")
                contentType = MediaType.APPLICATION_JSON
            }

            val prompt = "Based on this fitness coaching response, write a single concise sentence " +
                "(maximum 20 words) describing ONLY the training methodology and goal — do NOT mention " +
                "any specific equipment, machines, or exercises. Focus on the training approach " +
                "(e.g., 'interval training', 'low-impact cardio', 'strength circuits') and the fitness goal. " +
                "Return only the sentence, nothing else: $coachingResponse"

            val messages = listOf(mapOf("role" to "user", "content" to prompt))

            val requestBody = mapOf(
                "model" to haikuModel,
                "max_tokens" to 100,
                "messages" to messages
            )

            val entity = HttpEntity(requestBody, headers)

            val response = restTemplate.exchange(
                claudeApiUrl,
                HttpMethod.POST,
                entity,
                Map::class.java
            )

            val responseBody = response.body as Map<String, Any>
            val content = (responseBody["content"] as List<Map<String, Any>>)[0]["text"] as String
            content.trim().takeIf { it.isNotBlank() }
        } catch (e: Exception) {
            logger.warn("Haiku workout focus summary generation failed: ${e.message}")
            null
        }
    }

    @GetMapping("/test")
    fun testCoaching(): ResponseEntity<Map<String, String>> {
        return ResponseEntity.ok(mapOf(
            "message" to "Coaching controller is working",
            "availableSports" to Sport.values().joinToString(", ")
        ))
    }
}
