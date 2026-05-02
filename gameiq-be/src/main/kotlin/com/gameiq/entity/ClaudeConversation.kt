package com.gameiq.entity

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "claude_conversations")
data class ClaudeConversation(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,
    
    @Column(name = "session_id", nullable = false)
    val sessionId: String,
    
    @Column(name = "user_message", columnDefinition = "TEXT", nullable = false)
    val userMessage: String,
    
    @Column(name = "claude_response", columnDefinition = "TEXT", nullable = false)
    val claudeResponse: String,
    
    @Enumerated(EnumType.STRING)
    @Column(name = "sport")
    val sport: Sport? = null,
    
    @Enumerated(EnumType.STRING)
    @Column(name = "position")
    val position: Position? = null,
    
    @Enumerated(EnumType.STRING)
    @Column(name = "conversation_type", nullable = false)
    val conversationType: ConversationType,
    
    @Column(name = "system_prompt_used", columnDefinition = "TEXT")
    val systemPromptUsed: String? = null,
    
    @Column(name = "claude_model", nullable = false)
    val claudeModel: String = "claude-sonnet-4-20250514",
    
    @Column(name = "tokens_used_input")
    val tokensUsedInput: Int? = null,
    
    @Column(name = "tokens_used_output")
    val tokensUsedOutput: Int? = null,
    
    @Column(name = "api_cost_cents")
    val apiCostCents: Int? = null,
    
    @Column(name = "response_time_ms")
    val responseTimeMs: Long? = null,
    
    @Column(name = "user_rating")
    val userRating: Int? = null,
    
    @Column(name = "flagged_inappropriate", nullable = false)
    val flaggedInappropriate: Boolean = false,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "display_title")
    val displayTitle: String? = null
)

enum class ConversationType {
    TRAINING_ADVICE,
    POSITION_SPECIFIC_GUIDANCE,
    INJURY_PREVENTION,
    SKILL_DEVELOPMENT,
    GAME_STRATEGY,
    GENERAL_SPORTS_QUESTION,
    WORKOUT_CUSTOMIZATION
}
