package com.gameiq.controller

import com.gameiq.entity.*
import com.gameiq.repository.ClaudeConversationRepository
import com.gameiq.service.ClaudeService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

data class ChatRequest(
    val message: String,
    val sessionId: String? = null,
    val sport: String? = null,
    val position: String? = null,
    val conversationType: String = "TRAINING_ADVICE"
)

data class ChatResponse(
    val id: Long,
    val sessionId: String,
    val userMessage: String,
    val claudeResponse: String,
    val sport: String?,
    val position: String?,
    val conversationType: String,
    val timestamp: String,
    val tokenUsage: Int?,
    val displayTitle: String? = null
)

data class UpdateTitleRequest(val title: String)

@RestController
@RequestMapping("/conversations")
@CrossOrigin(origins = ["http://localhost:3000", "http://localhost:19006"])
class ClaudeConversationController(
    private val claudeService: ClaudeService,
    private val claudeConversationRepository: ClaudeConversationRepository
) {

    @PostMapping("/chat")
    fun chatWithClaude(
        @RequestParam userId: Long,
        @RequestBody request: ChatRequest
    ): ResponseEntity<ChatResponse> {
        return try {
            val conversation = claudeService.chatWithClaude(
                userId = userId,
                message = request.message,
                sessionId = request.sessionId,
                sport = request.sport?.let { Sport.valueOf(it.uppercase()) },
                position = request.position?.let { Position.valueOf(it.uppercase()) },
                conversationType = ConversationType.valueOf(request.conversationType.uppercase())
            )
            ResponseEntity.ok(conversation.toChatResponse())
        } catch (e: IllegalStateException) {
            ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(
                ChatResponse(
                    id = 0L,
                    sessionId = "",
                    userMessage = request.message,
                    claudeResponse = "Rate limit exceeded. ${e.message}",
                    sport = request.sport,
                    position = request.position,
                    conversationType = request.conversationType,
                    timestamp = java.time.LocalDateTime.now().toString(),
                    tokenUsage = null
                )
            )
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @PutMapping("/{conversationId}/title")
    fun updateConversationTitle(
        @PathVariable conversationId: Long,
        @RequestBody request: UpdateTitleRequest
    ): ResponseEntity<ChatResponse> {
        val conversation = claudeConversationRepository.findById(conversationId)
            .orElse(null) ?: return ResponseEntity.notFound().build()
        val updated = conversation.copy(displayTitle = request.title)
        val saved = claudeConversationRepository.save(updated)
        return ResponseEntity.ok(saved.toChatResponse())
    }

    @GetMapping("/available-options")
    fun getAvailableConversationOptions(): ResponseEntity<Map<String, List<String>>> {
        return ResponseEntity.ok(mapOf(
            "sports" to Sport.values().map { it.name },
            "positions" to Position.values().map { it.name },
            "conversationTypes" to ConversationType.values().map { it.name }
        ))
    }

    
    @GetMapping("/user/{userId}")
    fun getUserConversations(@PathVariable userId: Long): ResponseEntity<List<ChatResponse>> {
        return try {
            val chatResponses = claudeService.getUserConversations(userId)
                .filter { it.conversationType != ConversationType.WORKOUT_CUSTOMIZATION }
                .map { it.toChatResponse() }
            ResponseEntity.ok(chatResponses)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @GetMapping("/{conversationId}")
    fun getConversationById(@PathVariable conversationId: Long): ResponseEntity<ChatResponse> {
        val conversation = claudeConversationRepository.findById(conversationId)
            .orElse(null) ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(conversation.toChatResponse())
    }

    @GetMapping("/session/{sessionId}")
    fun getConversationsBySession(@PathVariable sessionId: String): ResponseEntity<List<ChatResponse>> {
        return try {
            val conversations = claudeConversationRepository.findConversationsBySessionOrdered(sessionId)
                .filter { it.conversationType != ConversationType.WORKOUT_CUSTOMIZATION }
            ResponseEntity.ok(conversations.map { it.toChatResponse() })
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }
}

// Extension to avoid repeating the mapping in every handler
private fun ClaudeConversation.toChatResponse() = ChatResponse(
    id = this.id,
    sessionId = this.sessionId,
    userMessage = this.userMessage,
    claudeResponse = this.claudeResponse,
    sport = this.sport?.name,
    position = this.position?.name,
    conversationType = this.conversationType.name,
    timestamp = this.createdAt.toString(),
    tokenUsage = (this.tokensUsedInput ?: 0) + (this.tokensUsedOutput ?: 0),
    displayTitle = this.displayTitle
)