package com.gameiq.service

import com.gameiq.entity.*
import com.gameiq.repository.ClaudeConversationRepository
import com.gameiq.repository.UserRepository
import com.gameiq.repository.WorkoutPlanRepository
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Nested
import org.mockito.kotlin.*
import org.springframework.http.*
import org.springframework.web.client.RestTemplate
import java.time.LocalDateTime
import java.util.*

class ClaudeServiceTest {

    // ─── Mocks ────────────────────────────────────────────────────────────────

    private val claudeConversationRepository: ClaudeConversationRepository = mock()
    private val userRepository: UserRepository = mock()
    private val workoutPlanRepository: WorkoutPlanRepository = mock()
    private val restTemplate: RestTemplate = mock()
    private val objectMapper = jacksonObjectMapper()

    private lateinit var service: ClaudeService

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private fun makeUser(
        id: Long = 1L,
        tier: SubscriptionTier = SubscriptionTier.TRIAL,
        trialChats: Int = 0,
        trialWorkouts: Int = 0
    ) = User(
        id = id,
        email = "test@test.com",
        firebaseUid = "uid-$id",
        displayName = "Test User",
        primarySport = Sport.FOOTBALL,
        primaryPosition = Position.QB,
        subscriptionTier = tier,
        trialChatsUsed = trialChats,
        trialWorkoutsUsed = trialWorkouts,
        createdAt = LocalDateTime.now(),
        updatedAt = LocalDateTime.now()
    )

    private fun stubClaudeApiResponse(text: String = "Great coaching advice!", inputTokens: Int = 100, outputTokens: Int = 200) {
        val responseBody: Map<String, Any> = mapOf(
            "content" to listOf(mapOf("text" to text)),
            "usage" to mapOf("input_tokens" to inputTokens, "output_tokens" to outputTokens)
        )
        val responseEntity = ResponseEntity(responseBody as Map<*, *>, HttpStatus.OK)
        whenever(restTemplate.exchange(any<String>(), eq(HttpMethod.POST), any(), eq(Map::class.java)))
            .thenReturn(responseEntity)
    }

    private fun stubConversationSave(user: User): ClaudeConversation {
        val saved = ClaudeConversation(
            id = 1L,
            user = user,
            sessionId = UUID.randomUUID().toString(),
            userMessage = "test message",
            claudeResponse = "Great coaching advice!",
            conversationType = ConversationType.GENERAL_SPORTS_QUESTION,
            systemPromptUsed = "system",
            claudeModel = "claude-sonnet-4-20250514",
            tokensUsedInput = 100,
            tokensUsedOutput = 200,
            apiCostCents = 4,
            responseTimeMs = 500
        )
        doReturn(saved).whenever(claudeConversationRepository).save(anyOrNull())
        doReturn(emptyList<ClaudeConversation>()).whenever(claudeConversationRepository).findConversationsBySessionOrdered(anyOrNull())
        return saved
    }

    @BeforeEach
    fun setUp() {
        service = ClaudeService(
            claudeConversationRepository = claudeConversationRepository,
            userRepository = userRepository,
            workoutPlanRepository = workoutPlanRepository,
            restTemplate = restTemplate,
            objectMapper = objectMapper
        )
        val keyField = ClaudeService::class.java.getDeclaredField("claudeApiKey")
        keyField.isAccessible = true
        keyField.set(service, "test-api-key")

        val urlField = ClaudeService::class.java.getDeclaredField("claudeApiUrl")
        urlField.isAccessible = true
        urlField.set(service, "https://api.anthropic.com/v1/messages")

        // Default safe stubs — individual tests override as needed
        doAnswer { it.arguments[0] }.whenever(userRepository).save(anyOrNull())
        doAnswer { it.arguments[0] }.whenever(workoutPlanRepository).save(anyOrNull())
    }

    // =========================================================================
    // checkRateLimit — TRIAL tier
    // =========================================================================

    @Nested
    inner class TrialTierRateLimitTests {

        @Test
        fun `trial user with 0 chats used can chat`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialChats = 0)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            stubClaudeApiResponse()
            stubConversationSave(user)

            assertDoesNotThrow {
                service.chatWithClaude(userId = 1L, message = "Help me with my routes")
            }
        }

        @Test
        fun `trial user with 2 chats used can still chat`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialChats = 2)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            stubClaudeApiResponse()
            stubConversationSave(user)

            assertDoesNotThrow {
                service.chatWithClaude(userId = 1L, message = "What drills should I run?")
            }
        }

        @Test
        fun `trial user at chat limit (3) is blocked`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialChats = 3)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))

            val ex = assertThrows<IllegalStateException> {
                service.chatWithClaude(userId = 1L, message = "One more question")
            }
            assertTrue(ex.message!!.contains("Trial chat limit reached"))
            assertTrue(ex.message!!.contains("3 questions"))
        }

        @Test
        fun `trial chat limit error message contains upgrade pricing`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialChats = 3)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))

            val ex = assertThrows<IllegalStateException> {
                service.chatWithClaude(userId = 1L, message = "blocked")
            }
            assertTrue(ex.message!!.contains("12.99"))
            assertTrue(ex.message!!.contains("19.99"))
        }

        @Test
        fun `trial user with 0 workouts used can generate workout`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialWorkouts = 0)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            stubClaudeApiResponse("Workout plan content here")
            stubConversationSave(user)

            assertDoesNotThrow {
                service.generateWorkoutPlan(
                    userId = 1L, sport = "FOOTBALL", position = "QB",
                    experienceLevel = "INTERMEDIATE", trainingPhase = "OFF_SEASON",
                    availableEquipment = "Full gym", sessionDuration = 45,
                    focusAreas = "Arm strength"
                )
            }
        }

        @Test
        fun `trial user at workout limit (1) is blocked`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialWorkouts = 1)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))

            val ex = assertThrows<IllegalStateException> {
                service.generateWorkoutPlan(
                    userId = 1L, sport = "FOOTBALL", position = "QB",
                    experienceLevel = "INTERMEDIATE", trainingPhase = "OFF_SEASON",
                    availableEquipment = "Full gym", sessionDuration = 45,
                    focusAreas = "Arm strength"
                )
            }
            assertTrue(ex.message!!.contains("Trial workout limit reached"))
            assertTrue(ex.message!!.contains("1 workout"))
        }

        @Test
        fun `trial workout limit error contains upgrade pricing`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialWorkouts = 1)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))

            val ex = assertThrows<IllegalStateException> {
                service.generateWorkoutPlan(
                    userId = 1L, sport = "FOOTBALL", position = "QB",
                    experienceLevel = "INTERMEDIATE", trainingPhase = "OFF_SEASON",
                    availableEquipment = "Full gym", sessionDuration = 45,
                    focusAreas = "Arm strength"
                )
            }
            assertTrue(ex.message!!.contains("12.99"))
            assertTrue(ex.message!!.contains("19.99"))
        }

        @Test
        fun `trial chat does NOT consume workout slot`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialChats = 0, trialWorkouts = 0)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            stubClaudeApiResponse()
            stubConversationSave(user)

            val captor = argumentCaptor<User>()
            whenever(userRepository.save(captor.capture())).thenReturn(user)

            service.chatWithClaude(userId = 1L, message = "Chat message")

            val savedUser = captor.lastValue
            assertEquals(1, savedUser.trialChatsUsed)
            assertEquals(0, savedUser.trialWorkoutsUsed)
        }

        @Test
        fun `trial workout does NOT consume chat slot`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialChats = 0, trialWorkouts = 0)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            stubClaudeApiResponse("Workout plan")
            stubConversationSave(user)

            val captor = argumentCaptor<User>()
            whenever(userRepository.save(captor.capture())).thenReturn(user)

            service.generateWorkoutPlan(
                userId = 1L, sport = "FOOTBALL", position = "QB",
                experienceLevel = "INTERMEDIATE", trainingPhase = "OFF_SEASON",
                availableEquipment = "Full gym", sessionDuration = 45,
                focusAreas = "Arm strength"
            )

            val savedUser = captor.lastValue
            assertEquals(0, savedUser.trialChatsUsed)
            assertEquals(1, savedUser.trialWorkoutsUsed)
        }
    }

    // =========================================================================
    // checkRateLimit — NONE tier
    // =========================================================================

    @Nested
    inner class NoneTierTests {

        @Test
        fun `NONE tier is always blocked from chat`() {
            val user = makeUser(tier = SubscriptionTier.NONE)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))

            val ex = assertThrows<IllegalStateException> {
                service.chatWithClaude(userId = 1L, message = "hello")
            }
            assertTrue(ex.message!!.contains("No active subscription"))
        }

        @Test
        fun `NONE tier is always blocked from workouts`() {
            val user = makeUser(tier = SubscriptionTier.NONE)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))

            val ex = assertThrows<IllegalStateException> {
                service.generateWorkoutPlan(
                    userId = 1L, sport = "FOOTBALL", position = "QB",
                    experienceLevel = "INTERMEDIATE", trainingPhase = "OFF_SEASON",
                    availableEquipment = "Full gym", sessionDuration = 45,
                    focusAreas = "Arm strength"
                )
            }
            assertTrue(ex.message!!.contains("No active subscription"))
        }
    }

    // =========================================================================
    // checkRateLimit — BASIC tier ($4.00 = 400 cents)
    // =========================================================================

    @Nested
    inner class BasicTierRateLimitTests {

        @Test
        fun `BASIC user under 40000 units can chat`() {
            val user = makeUser(tier = SubscriptionTier.BASIC)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(claudeConversationRepository.getCostByUserSince(anyOrNull(), anyOrNull())).thenReturn(39999L)
            stubClaudeApiResponse()
            stubConversationSave(user)

            assertDoesNotThrow {
                service.chatWithClaude(userId = 1L, message = "Any advice?")
            }
        }

        @Test
        fun `BASIC user at exactly 40000 units is blocked`() {
            val user = makeUser(tier = SubscriptionTier.BASIC)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(claudeConversationRepository.getCostByUserSince(anyOrNull(), anyOrNull())).thenReturn(40000L)

            val ex = assertThrows<IllegalStateException> {
                service.chatWithClaude(userId = 1L, message = "blocked")
            }
            assertTrue(ex.message!!.contains("4.00"))
        }

        @Test
        fun `BASIC user over 40000 units is blocked`() {
            val user = makeUser(tier = SubscriptionTier.BASIC)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(claudeConversationRepository.getCostByUserSince(anyOrNull(), anyOrNull())).thenReturn(40001L)

            val ex = assertThrows<IllegalStateException> {
                service.chatWithClaude(userId = 1L, message = "blocked")
            }
            assertTrue(ex.message!!.contains("Monthly AI budget reached"))
            assertTrue(ex.message!!.contains("4.00"))
        }

        @Test
        fun `BASIC limit error message mentions upgrade to Premium`() {
            val user = makeUser(tier = SubscriptionTier.BASIC)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(claudeConversationRepository.getCostByUserSince(anyOrNull(), anyOrNull())).thenReturn(40000L)

            val ex = assertThrows<IllegalStateException> {
                service.chatWithClaude(userId = 1L, message = "blocked")
            }
            assertTrue(ex.message!!.contains("Premium"))
        }

        @Test
        fun `BASIC user with null cost (no history) can chat`() {
            val user = makeUser(tier = SubscriptionTier.BASIC)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(claudeConversationRepository.getCostByUserSince(anyOrNull(), anyOrNull())).thenReturn(null)
            stubClaudeApiResponse()
            stubConversationSave(user)

            assertDoesNotThrow {
                service.chatWithClaude(userId = 1L, message = "First ever question")
            }
        }
    }

    // =========================================================================
    // checkRateLimit — PREMIUM tier ($8.00 = 800 cents)
    // =========================================================================

    @Nested
    inner class PremiumTierRateLimitTests {

        @Test
        fun `PREMIUM user under 80000 units can chat`() {
            val user = makeUser(tier = SubscriptionTier.PREMIUM)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(claudeConversationRepository.getCostByUserSince(anyOrNull(), anyOrNull())).thenReturn(79999L)
            stubClaudeApiResponse()
            stubConversationSave(user)

            assertDoesNotThrow {
                service.chatWithClaude(userId = 1L, message = "Advanced question")
            }
        }

        @Test
        fun `PREMIUM user at exactly 80000 units is blocked`() {
            val user = makeUser(tier = SubscriptionTier.PREMIUM)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(claudeConversationRepository.getCostByUserSince(anyOrNull(), anyOrNull())).thenReturn(80000L)

            val ex = assertThrows<IllegalStateException> {
                service.chatWithClaude(userId = 1L, message = "blocked")
            }
            assertTrue(ex.message!!.contains("8.00"))
        }

        @Test
        fun `PREMIUM user over 80000 units is blocked`() {
            val user = makeUser(tier = SubscriptionTier.PREMIUM)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(claudeConversationRepository.getCostByUserSince(anyOrNull(), anyOrNull())).thenReturn(80001L)

            val ex = assertThrows<IllegalStateException> {
                service.chatWithClaude(userId = 1L, message = "blocked")
            }
            assertTrue(ex.message!!.contains("Monthly AI budget reached"))
        }

        @Test
        fun `PREMIUM budget is higher than BASIC budget`() {
            val premiumUser = makeUser(id = 1L, tier = SubscriptionTier.PREMIUM)
            val basicUser   = makeUser(id = 2L, tier = SubscriptionTier.BASIC)

            whenever(userRepository.findById(1L)).thenReturn(Optional.of(premiumUser))
            whenever(userRepository.findById(2L)).thenReturn(Optional.of(basicUser))
            whenever(claudeConversationRepository.getCostByUserSince(anyOrNull(), anyOrNull())).thenReturn(79999L)
            stubClaudeApiResponse()
            stubConversationSave(premiumUser)

            assertDoesNotThrow { service.chatWithClaude(userId = 1L, message = "premium ok") }
            assertThrows<IllegalStateException> { service.chatWithClaude(userId = 2L, message = "basic blocked") }
        }
    }

    // =========================================================================
    // calculateApiCost
    // =========================================================================

    @Nested
    inner class ApiCostCalculationTests {

        private fun calcCost(inputTokens: Int, outputTokens: Int): Int {
            val method = ClaudeService::class.java.getDeclaredMethod(
                "calculateApiCost", Int::class.java, Int::class.java
            )
            method.isAccessible = true
            return method.invoke(service, inputTokens, outputTokens) as Int
        }

        @Test
        fun `zero tokens produce zero cost`() {
            assertEquals(0, calcCost(0, 0))
        }

        @Test
        fun `typical chat (181 input, 417 output) costs approximately 68 units`() {
            assertEquals(68, calcCost(181, 417))
        }

        @Test
        fun `typical workout (3094 input, 4000 output) costs approximately 693 units`() {
            assertEquals(693, calcCost(3094, 4000))
        }

        @Test
        fun `1 million input tokens costs 30000 units`() {
            assertEquals(30000, calcCost(1_000_000, 0))
        }

        @Test
        fun `1 million output tokens costs 150000 units`() {
            assertEquals(150000, calcCost(0, 1_000_000))
        }

        @Test
        fun `cost increases monotonically with token count`() {
            assertTrue(calcCost(100, 100) <= calcCost(500, 500))
            assertTrue(calcCost(500, 500) <= calcCost(2000, 2000))
        }
    }

    // =========================================================================
    // incrementTrialUsage
    // =========================================================================

    @Nested
    inner class IncrementTrialUsageTests {

        @Test
        fun `incrementTrialUsage does nothing for BASIC user`() {
            val user = makeUser(tier = SubscriptionTier.BASIC, trialChats = 0)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(claudeConversationRepository.getCostByUserSince(anyOrNull(), anyOrNull())).thenReturn(0L)
            stubClaudeApiResponse()
            stubConversationSave(user)

            service.chatWithClaude(userId = 1L, message = "basic chat")

            verify(userRepository, never()).save(anyOrNull())
        }

        @Test
        fun `incrementTrialUsage does nothing for PREMIUM user`() {
            val user = makeUser(tier = SubscriptionTier.PREMIUM, trialChats = 0)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(claudeConversationRepository.getCostByUserSince(anyOrNull(), anyOrNull())).thenReturn(0L)
            stubClaudeApiResponse()
            stubConversationSave(user)

            service.chatWithClaude(userId = 1L, message = "premium chat")

            verify(userRepository, never()).save(anyOrNull())
        }

        @Test
        fun `trial chat increments trialChatsUsed by exactly 1`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialChats = 1)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            stubClaudeApiResponse()
            stubConversationSave(user)

            val captor = argumentCaptor<User>()
            whenever(userRepository.save(captor.capture())).thenReturn(user)

            service.chatWithClaude(userId = 1L, message = "second chat")

            assertEquals(2, captor.lastValue.trialChatsUsed)
        }

        @Test
        fun `trial workout increments trialWorkoutsUsed by exactly 1`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialWorkouts = 0)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            stubClaudeApiResponse("Workout content")
            stubConversationSave(user)

            val captor = argumentCaptor<User>()
            whenever(userRepository.save(captor.capture())).thenReturn(user)

            service.generateWorkoutPlan(
                userId = 1L, sport = "FOOTBALL", position = "QB",
                experienceLevel = "INTERMEDIATE", trainingPhase = "OFF_SEASON",
                availableEquipment = "Full gym", sessionDuration = 45,
                focusAreas = "Arm strength"
            )

            assertEquals(1, captor.lastValue.trialWorkoutsUsed)
        }
    }

    // =========================================================================
    // skipRateLimitAndTracking (double-counting guard)
    // =========================================================================

    @Nested
    inner class SkipRateLimitFlagTests {

        @Test
        fun `generateWorkoutPlan does not double-count trial chat slot`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialChats = 0, trialWorkouts = 0)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            stubClaudeApiResponse("Workout plan")
            stubConversationSave(user)

            val captor = argumentCaptor<User>()
            whenever(userRepository.save(captor.capture())).thenReturn(user)

            service.generateWorkoutPlan(
                userId = 1L, sport = "FOOTBALL", position = "QB",
                experienceLevel = "INTERMEDIATE", trainingPhase = "OFF_SEASON",
                availableEquipment = "Full gym", sessionDuration = 45,
                focusAreas = "Arm strength"
            )

            verify(userRepository, times(1)).save(anyOrNull())
            assertEquals(0, captor.lastValue.trialChatsUsed, "Chat slot must not be consumed during workout generation")
            assertEquals(1, captor.lastValue.trialWorkoutsUsed)
        }

        @Test
        fun `chatWithClaude with skipRateLimitAndTracking=true skips rate limit check`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialChats = 3)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            stubClaudeApiResponse()
            stubConversationSave(user)

            assertDoesNotThrow {
                service.chatWithClaude(
                    userId = 1L,
                    message = "internal workout message",
                    skipRateLimitAndTracking = true
                )
            }
        }

        @Test
        fun `chatWithClaude with skipRateLimitAndTracking=true does not increment trial counters`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialChats = 0)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            stubClaudeApiResponse()
            stubConversationSave(user)

            service.chatWithClaude(
                userId = 1L,
                message = "internal call",
                skipRateLimitAndTracking = true
            )

            verify(userRepository, never()).save(anyOrNull())
        }
    }

    // =========================================================================
    // User not found
    // =========================================================================

    @Test
    fun `chatWithClaude throws for unknown userId`() {
        whenever(userRepository.findById(999L)).thenReturn(Optional.empty())

        assertThrows<IllegalArgumentException> {
            service.chatWithClaude(userId = 999L, message = "hello")
        }
    }

    @Test
    fun `generateWorkoutPlan throws for unknown userId`() {
        whenever(userRepository.findById(999L)).thenReturn(Optional.empty())

        assertThrows<IllegalArgumentException> {
            service.generateWorkoutPlan(
                userId = 999L, sport = "FOOTBALL", position = "QB",
                experienceLevel = "INTERMEDIATE", trainingPhase = "OFF_SEASON",
                availableEquipment = "Full gym", sessionDuration = 45,
                focusAreas = "Arm strength"
            )
        }
    }

    @Test
    fun `generateWorkoutPlan throws for unknown position string`() {
        val user = makeUser(tier = SubscriptionTier.TRIAL, trialWorkouts = 0)
        whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))

        assertThrows<IllegalArgumentException> {
            service.generateWorkoutPlan(
                userId = 1L, sport = "FOOTBALL", position = "KICKER",
                experienceLevel = "INTERMEDIATE", trainingPhase = "OFF_SEASON",
                availableEquipment = "Full gym", sessionDuration = 45,
                focusAreas = "Leg strength"
            )
        }
    }

    // =========================================================================
    // GENERAL_FITNESS sport — no position, goal-oriented workouts
    // =========================================================================

    @Nested
    inner class GeneralFitnessTierTests {

        private val generalFitnessWorkoutJson = """
            {
                "workoutTitle": "General Fitness Full-Body Session",
                "positionFocus": "Targets the user's fitness goals",
                "exercises": [
                    {"name": "Pushup", "sets": 3, "reps": "10"}
                ],
                "equipmentNeeded": "None",
                "focusAreas": "Full body",
                "estimatedDuration": 45
            }
        """.trimIndent()

        @Test
        fun `GENERAL_FITNESS sport skips position lookup and does not throw`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialWorkouts = 0)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            stubClaudeApiResponse(generalFitnessWorkoutJson)
            stubConversationSave(user)

            assertDoesNotThrow {
                service.generateWorkoutPlan(
                    userId = 1L, sport = "GENERAL_FITNESS", position = null,
                    experienceLevel = "INTERMEDIATE", trainingPhase = "OFF_SEASON",
                    availableEquipment = "None", sessionDuration = 45,
                    focusAreas = "Full body"
                )
            }
        }

        @Test
        fun `GENERAL_FITNESS workout increments trialWorkoutsUsed`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialWorkouts = 0)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            stubClaudeApiResponse(generalFitnessWorkoutJson)
            stubConversationSave(user)

            val captor = argumentCaptor<User>()
            whenever(userRepository.save(captor.capture())).thenReturn(user)

            service.generateWorkoutPlan(
                userId = 1L, sport = "GENERAL_FITNESS", position = null,
                experienceLevel = "INTERMEDIATE", trainingPhase = "OFF_SEASON",
                availableEquipment = "None", sessionDuration = 45,
                focusAreas = "Full body"
            )

            assertEquals(1, captor.lastValue.trialWorkoutsUsed)
        }

        @Test
        fun `GENERAL_FITNESS workout blocked when trial limit reached`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL, trialWorkouts = 1)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))

            val ex = assertThrows<IllegalStateException> {
                service.generateWorkoutPlan(
                    userId = 1L, sport = "GENERAL_FITNESS", position = null,
                    experienceLevel = "INTERMEDIATE", trainingPhase = "OFF_SEASON",
                    availableEquipment = "None", sessionDuration = 45,
                    focusAreas = "Full body"
                )
            }
            assertTrue(ex.message!!.contains("Trial workout limit reached"))
        }

        @Test
        fun `GENERAL_FITNESS BASIC user under budget can generate workout`() {
            val user = makeUser(tier = SubscriptionTier.BASIC)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(claudeConversationRepository.getCostByUserSince(anyOrNull(), anyOrNull())).thenReturn(399L)
            stubClaudeApiResponse(generalFitnessWorkoutJson)
            stubConversationSave(user)

            assertDoesNotThrow {
                service.generateWorkoutPlan(
                    userId = 1L, sport = "GENERAL_FITNESS", position = null,
                    experienceLevel = "INTERMEDIATE", trainingPhase = "OFF_SEASON",
                    availableEquipment = "None", sessionDuration = 45,
                    focusAreas = "Full body"
                )
            }
        }

        @Test
        fun `GENERAL_FITNESS PREMIUM user under budget can generate workout`() {
            val user = makeUser(tier = SubscriptionTier.PREMIUM)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(claudeConversationRepository.getCostByUserSince(anyOrNull(), anyOrNull())).thenReturn(799L)
            stubClaudeApiResponse(generalFitnessWorkoutJson)
            stubConversationSave(user)

            assertDoesNotThrow {
                service.generateWorkoutPlan(
                    userId = 1L, sport = "GENERAL_FITNESS", position = null,
                    experienceLevel = "INTERMEDIATE", trainingPhase = "OFF_SEASON",
                    availableEquipment = "None", sessionDuration = 45,
                    focusAreas = "Full body"
                )
            }
        }
    }
}