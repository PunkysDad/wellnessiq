package com.gameiq.controller

import com.gameiq.entity.*
import com.gameiq.repository.ClaudeConversationRepository
import com.gameiq.service.ClaudeService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Assertions.*
import org.mockito.kotlin.*
import org.springframework.http.HttpStatus
import java.time.LocalDateTime
import java.util.*

class ClaudeConversationControllerTest {

    private val claudeService: ClaudeService = mock()
    private val claudeConversationRepository: ClaudeConversationRepository = mock()

    private lateinit var controller: ClaudeConversationController

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private fun makeUser() = User(
        id = 1L,
        email = "test@test.com",
        firebaseUid = "uid-1",
        displayName = "Test User",
        subscriptionTier = SubscriptionTier.TRIAL,
        createdAt = LocalDateTime.now(),
        updatedAt = LocalDateTime.now()
    )

    private fun makeConversation(
        id: Long = 1L,
        userMessage: String = "What drills should I run?",
        claudeResponse: String = "Great question! Here are some drills...",
        sport: Sport? = Sport.FOOTBALL,
        position: Position? = Position.QB,
        conversationType: ConversationType = ConversationType.TRAINING_ADVICE,
        inputTokens: Int = 100,
        outputTokens: Int = 200
    ) = ClaudeConversation(
        id = id,
        user = makeUser(),
        sessionId = "session-$id",
        userMessage = userMessage,
        claudeResponse = claudeResponse,
        sport = sport,
        position = position,
        conversationType = conversationType,
        systemPromptUsed = "system",
        claudeModel = "claude-sonnet-4-20250514",
        tokensUsedInput = inputTokens,
        tokensUsedOutput = outputTokens,
        apiCostCents = 4,
        responseTimeMs = 500,
        createdAt = LocalDateTime.now()
    )

    private fun makeChatRequest(
        message: String = "What drills should I run?",
        sessionId: String? = null,
        sport: String? = "FOOTBALL",
        position: String? = "QB",
        conversationType: String = "TRAINING_ADVICE"
    ) = ChatRequest(
        message = message,
        sessionId = sessionId,
        sport = sport,
        position = position,
        conversationType = conversationType
    )

    @BeforeEach
    fun setUp() {
        controller = ClaudeConversationController(claudeService, claudeConversationRepository)
    }

    // =========================================================================
    // POST /conversations/chat — happy path
    // =========================================================================

    @Nested
    inner class ChatHappyPath {

        @Test
        fun `returns 200 on successful chat`() {
            val conversation = makeConversation()
            whenever(claudeService.chatWithClaude(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), any(), any(), anyOrNull()))
                .thenReturn(conversation)

            val response = controller.chatWithClaude(1L, makeChatRequest())

            assertEquals(HttpStatus.OK, response.statusCode)
        }

        @Test
        fun `response body maps conversation fields correctly`() {
            val conversation = makeConversation(
                id = 7L,
                userMessage = "How do I improve my pocket presence?",
                claudeResponse = "Focus on footwork drills.",
                sport = Sport.FOOTBALL,
                position = Position.QB
            )
            whenever(claudeService.chatWithClaude(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), any(), any(), anyOrNull()))
                .thenReturn(conversation)

            val body = controller.chatWithClaude(1L, makeChatRequest()).body!!
            assertEquals(7L, body.id)
            assertEquals("How do I improve my pocket presence?", body.userMessage)
            assertEquals("Focus on footwork drills.", body.claudeResponse)
            assertEquals("FOOTBALL", body.sport)
            assertEquals("QB", body.position)
        }

        @Test
        fun `tokenUsage is sum of input and output tokens`() {
            val conversation = makeConversation(inputTokens = 150, outputTokens = 350)
            whenever(claudeService.chatWithClaude(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), any(), any(), anyOrNull()))
                .thenReturn(conversation)

            val body = controller.chatWithClaude(1L, makeChatRequest()).body!!
            assertEquals(500, body.tokenUsage)
        }

        @Test
        fun `null sport in request is passed through as null`() {
            val conversation = makeConversation(sport = null, position = null)
            whenever(claudeService.chatWithClaude(any(), any(), anyOrNull(), isNull(), isNull(), any(), any(), anyOrNull()))
                .thenReturn(conversation)

            val response = controller.chatWithClaude(1L, makeChatRequest(sport = null, position = null))

            assertEquals(HttpStatus.OK, response.statusCode)
            assertNull(response.body!!.sport)
        }

        @Test
        fun `sport string is converted to Sport enum before service call`() {
            val conversation = makeConversation(sport = Sport.BASKETBALL)
            whenever(claudeService.chatWithClaude(any(), any(), anyOrNull(), eq(Sport.BASKETBALL), anyOrNull(), any(), any(), anyOrNull()))
                .thenReturn(conversation)

            val response = controller.chatWithClaude(1L, makeChatRequest(sport = "BASKETBALL"))

            assertEquals(HttpStatus.OK, response.statusCode)
        }

        @Test
        fun `position string is converted to Position enum before service call`() {
            val conversation = makeConversation(position = Position.PG)
            whenever(claudeService.chatWithClaude(any(), any(), anyOrNull(), anyOrNull(), eq(Position.PG), any(), any(), anyOrNull()))
                .thenReturn(conversation)

            val response = controller.chatWithClaude(1L, makeChatRequest(position = "PG"))

            assertEquals(HttpStatus.OK, response.statusCode)
        }

        @Test
        fun `sessionId is forwarded to service`() {
            val conversation = makeConversation()
            whenever(claudeService.chatWithClaude(any(), any(), eq("abc-123"), anyOrNull(), anyOrNull(), any(), any(), anyOrNull()))
                .thenReturn(conversation)

            val response = controller.chatWithClaude(1L, makeChatRequest(sessionId = "abc-123"))

            assertEquals(HttpStatus.OK, response.statusCode)
        }
    }

    // =========================================================================
    // POST /conversations/chat — trial/subscription limit enforcement
    // =========================================================================

    @Nested
    inner class ChatTrialEnforcement {

        @Test
        fun `trial chat limit returns 429`() {
            whenever(claudeService.chatWithClaude(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), any(), any(), anyOrNull()))
                .thenThrow(IllegalStateException("Trial chat limit reached (3 questions)."))

            val response = controller.chatWithClaude(1L, makeChatRequest())

            assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.statusCode)
        }

        @Test
        fun `trial limit response body contains error message`() {
            val errMsg = "Trial chat limit reached (3 questions). Subscribe to Basic (\$12.99) or Premium (\$19.99)."
            whenever(claudeService.chatWithClaude(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), any(), any(), anyOrNull()))
                .thenThrow(IllegalStateException(errMsg))

            val body = controller.chatWithClaude(1L, makeChatRequest()).body!!
            assertTrue(body.claudeResponse.contains(errMsg))
        }

        @Test
        fun `BASIC monthly budget exceeded returns 429`() {
            whenever(claudeService.chatWithClaude(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), any(), any(), anyOrNull()))
                .thenThrow(IllegalStateException("Monthly AI budget reached (\$4.00 of \$4.00)."))

            val response = controller.chatWithClaude(1L, makeChatRequest())

            assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.statusCode)
        }

        @Test
        fun `NONE tier blocked returns 429`() {
            whenever(claudeService.chatWithClaude(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), any(), any(), anyOrNull()))
                .thenThrow(IllegalStateException("No active subscription."))

            val response = controller.chatWithClaude(1L, makeChatRequest())

            assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.statusCode)
        }

        @Test
        fun `rate limit response echoes original user message`() {
            whenever(claudeService.chatWithClaude(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), any(), any(), anyOrNull()))
                .thenThrow(IllegalStateException("Trial chat limit reached."))

            val body = controller.chatWithClaude(1L, makeChatRequest(message = "Help me with routes")).body!!
            assertEquals("Help me with routes", body.userMessage)
        }

        @Test
        fun `rate limit response preserves sport and position from request`() {
            whenever(claudeService.chatWithClaude(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), any(), any(), anyOrNull()))
                .thenThrow(IllegalStateException("Trial chat limit reached."))

            val body = controller.chatWithClaude(1L, makeChatRequest(sport = "FOOTBALL", position = "QB")).body!!
            assertEquals("FOOTBALL", body.sport)
            assertEquals("QB", body.position)
        }

        @Test
        fun `rate limit response id is 0`() {
            whenever(claudeService.chatWithClaude(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), any(), any(), anyOrNull()))
                .thenThrow(IllegalStateException("Trial chat limit reached."))

            val body = controller.chatWithClaude(1L, makeChatRequest()).body!!
            assertEquals(0L, body.id)
        }
    }

    // =========================================================================
    // POST /conversations/chat — generic error handling
    // =========================================================================

    @Nested
    inner class ChatErrorHandling {

        @Test
        fun `unexpected exception returns 400`() {
            whenever(claudeService.chatWithClaude(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), any(), any(), anyOrNull()))
                .thenThrow(RuntimeException("Claude API unavailable"))

            val response = controller.chatWithClaude(1L, makeChatRequest())

            assertEquals(HttpStatus.BAD_REQUEST, response.statusCode)
        }

        @Test
        fun `unexpected exception returns no body`() {
            whenever(claudeService.chatWithClaude(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), any(), any(), anyOrNull()))
                .thenThrow(RuntimeException("Claude API unavailable"))

            val response = controller.chatWithClaude(1L, makeChatRequest())

            assertNull(response.body)
        }
    }

    // =========================================================================
    // GET /conversations/user/{userId}
    // =========================================================================

    @Nested
    inner class GetUserConversationsTests {

        @Test
        fun `returns 200 with list of chat responses`() {
            whenever(claudeService.getUserConversations(1L))
                .thenReturn(listOf(makeConversation(id = 1L), makeConversation(id = 2L)))

            val response = controller.getUserConversations(1L)

            assertEquals(HttpStatus.OK, response.statusCode)
            assertEquals(2, response.body!!.size)
        }

        @Test
        fun `filters out WORKOUT_CUSTOMIZATION conversations`() {
            whenever(claudeService.getUserConversations(1L)).thenReturn(listOf(
                makeConversation(id = 1L, conversationType = ConversationType.TRAINING_ADVICE),
                makeConversation(id = 2L, conversationType = ConversationType.WORKOUT_CUSTOMIZATION),
                makeConversation(id = 3L, conversationType = ConversationType.GENERAL_SPORTS_QUESTION)
            ))

            val body = controller.getUserConversations(1L).body!!
            assertEquals(2, body.size)
            assertTrue(body.none { it.conversationType == ConversationType.WORKOUT_CUSTOMIZATION.name })
        }

        @Test
        fun `returns empty list when user has no non-workout conversations`() {
            whenever(claudeService.getUserConversations(1L)).thenReturn(listOf(
                makeConversation(conversationType = ConversationType.WORKOUT_CUSTOMIZATION)
            ))

            val body = controller.getUserConversations(1L).body!!
            assertTrue(body.isEmpty())
        }

        @Test
        fun `service exception returns 400`() {
            whenever(claudeService.getUserConversations(1L))
                .thenThrow(RuntimeException("DB error"))

            val response = controller.getUserConversations(1L)

            assertEquals(HttpStatus.BAD_REQUEST, response.statusCode)
        }
    }

    // =========================================================================
    // GET /conversations/{conversationId}
    // =========================================================================

    @Nested
    inner class GetConversationByIdTests {

        @Test
        fun `returns 200 with conversation when found`() {
            val conversation = makeConversation(id = 5L)
            whenever(claudeConversationRepository.findById(5L)).thenReturn(Optional.of(conversation))

            val response = controller.getConversationById(5L)

            assertEquals(HttpStatus.OK, response.statusCode)
            assertEquals(5L, response.body!!.id)
        }

        @Test
        fun `returns 404 when conversation not found`() {
            whenever(claudeConversationRepository.findById(999L)).thenReturn(Optional.empty())

            val response = controller.getConversationById(999L)

            assertEquals(HttpStatus.NOT_FOUND, response.statusCode)
        }
    }
}