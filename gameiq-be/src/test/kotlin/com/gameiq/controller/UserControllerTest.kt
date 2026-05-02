package com.gameiq.controller

import com.gameiq.entity.*
import com.gameiq.repository.ClaudeConversationRepository
import com.gameiq.service.ClaudeService
import com.gameiq.service.UserService
import com.gameiq.service.WorkoutService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Assertions.*
import org.mockito.kotlin.*
import org.springframework.http.HttpStatus
import java.time.LocalDateTime

class UserControllerTest {

    private val userService: UserService = mock()
    private val claudeService: ClaudeService = mock()
    private val workoutService: WorkoutService = mock()
    private val claudeConversationRepository: ClaudeConversationRepository = mock()

    private lateinit var controller: UserController

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private fun makeUser(
        id: Long = 1L,
        tier: SubscriptionTier = SubscriptionTier.TRIAL,
        sport: Sport? = Sport.FOOTBALL,
        position: Position? = Position.QB,
        isActive: Boolean = true,
        fitnessGoals: String = ""
    ) = User(
        id = id,
        email = "test@test.com",
        firebaseUid = "uid-$id",
        displayName = "Test User",
        subscriptionTier = tier,
        primarySport = sport,
        primaryPosition = position,
        isActive = isActive,
        fitnessGoals = fitnessGoals,
        createdAt = LocalDateTime.now(),
        updatedAt = LocalDateTime.now()
    )

    @BeforeEach
    fun setUp() {
        controller = UserController(userService, claudeService, workoutService, claudeConversationRepository)
    }

    // =========================================================================
    // PUT /users/{userId}/subscription — the RevenueCat sync endpoint
    // =========================================================================

    @Nested
    inner class UpdateSubscriptionTierTests {

        @Test
        fun `upgrading TRIAL to BASIC returns 200`() {
            val updatedUser = makeUser(tier = SubscriptionTier.BASIC)
            whenever(userService.upgradeSubscription(1L, SubscriptionTier.BASIC)).thenReturn(updatedUser)

            val response = controller.updateSubscriptionTier(1L, SubscriptionUpdateRequest("BASIC"))

            assertEquals(HttpStatus.OK, response.statusCode)
        }

        @Test
        fun `upgrading TRIAL to PREMIUM returns 200`() {
            val updatedUser = makeUser(tier = SubscriptionTier.PREMIUM)
            whenever(userService.upgradeSubscription(1L, SubscriptionTier.PREMIUM)).thenReturn(updatedUser)

            val response = controller.updateSubscriptionTier(1L, SubscriptionUpdateRequest("PREMIUM"))

            assertEquals(HttpStatus.OK, response.statusCode)
        }

        @Test
        fun `response body contains success=true`() {
            val updatedUser = makeUser(tier = SubscriptionTier.BASIC)
            whenever(userService.upgradeSubscription(1L, SubscriptionTier.BASIC)).thenReturn(updatedUser)

            val body = controller.updateSubscriptionTier(1L, SubscriptionUpdateRequest("BASIC")).body!!
            assertEquals(true, body["success"])
        }

        @Test
        fun `response body newTier matches the tier that was set`() {
            val updatedUser = makeUser(tier = SubscriptionTier.PREMIUM)
            whenever(userService.upgradeSubscription(1L, SubscriptionTier.PREMIUM)).thenReturn(updatedUser)

            val body = controller.updateSubscriptionTier(1L, SubscriptionUpdateRequest("PREMIUM")).body!!
            assertEquals("PREMIUM", body["newTier"])
        }

        @Test
        fun `tier string matching is case-insensitive`() {
            val updatedUser = makeUser(tier = SubscriptionTier.BASIC)
            whenever(userService.upgradeSubscription(1L, SubscriptionTier.BASIC)).thenReturn(updatedUser)

            val response = controller.updateSubscriptionTier(1L, SubscriptionUpdateRequest("basic"))

            assertEquals(HttpStatus.OK, response.statusCode)
            assertEquals("BASIC", response.body!!["newTier"])
        }

        @Test
        fun `invalid tier string returns 400`() {
            val response = controller.updateSubscriptionTier(1L, SubscriptionUpdateRequest("GOLD"))

            assertEquals(HttpStatus.BAD_REQUEST, response.statusCode)
        }

        @Test
        fun `invalid tier string response contains success=false`() {
            val response = controller.updateSubscriptionTier(1L, SubscriptionUpdateRequest("GOLD"))

            assertEquals(false, response.body!!["success"])
        }

        @Test
        fun `invalid tier string response contains error message`() {
            val response = controller.updateSubscriptionTier(1L, SubscriptionUpdateRequest("GOLD"))

            assertTrue(response.body!!["message"].toString().contains("GOLD"))
        }

        @Test
        fun `user not found returns 400 with success=false`() {
            whenever(userService.upgradeSubscription(999L, SubscriptionTier.BASIC))
                .thenThrow(IllegalArgumentException("User not found: 999"))

            val response = controller.updateSubscriptionTier(999L, SubscriptionUpdateRequest("BASIC"))

            assertEquals(HttpStatus.BAD_REQUEST, response.statusCode)
            assertEquals(false, response.body!!["success"])
        }

        @Test
        fun `userService upgradeSubscription is called with correct userId and tier`() {
            val updatedUser = makeUser(tier = SubscriptionTier.BASIC)
            whenever(userService.upgradeSubscription(anyOrNull(), anyOrNull())).thenReturn(updatedUser)

            controller.updateSubscriptionTier(42L, SubscriptionUpdateRequest("BASIC"))

            verify(userService).upgradeSubscription(42L, SubscriptionTier.BASIC)
        }

        @Test
        fun `NONE is a valid tier value and returns 200`() {
            val updatedUser = makeUser(tier = SubscriptionTier.NONE)
            whenever(userService.upgradeSubscription(1L, SubscriptionTier.NONE)).thenReturn(updatedUser)

            val response = controller.updateSubscriptionTier(1L, SubscriptionUpdateRequest("NONE"))

            assertEquals(HttpStatus.OK, response.statusCode)
            assertEquals("NONE", response.body!!["newTier"])
        }
    }

    // =========================================================================
    // UserService.upgradeSubscription — the persistence layer
    // =========================================================================

    @Nested
    inner class UserServiceUpgradeSubscriptionTests {

        // These tests exercise UserService directly (no controller layer)
        // to verify the DB write behaviour independently of the HTTP layer.

        private val userRepository: com.gameiq.repository.UserRepository = mock()
        private val quizService: com.gameiq.service.QuizService = mock()
        private val quizSessionRepository: com.gameiq.repository.QuizSessionRepository = mock()
        private val quizSessionAttemptRepository: com.gameiq.repository.QuizSessionAttemptRepository = mock()

        private lateinit var service: UserService

        @BeforeEach
        fun setUpService() {
            service = UserService(userRepository, quizService, quizSessionRepository, quizSessionAttemptRepository)
        }

        @Test
        fun `upgradeSubscription persists new tier to DB`() {
            val existing = makeUser(tier = SubscriptionTier.TRIAL)
            whenever(userRepository.findById(1L)).thenReturn(java.util.Optional.of(existing))
            doAnswer { it.arguments[0] }.whenever(userRepository).save(anyOrNull())

            service.upgradeSubscription(1L, SubscriptionTier.BASIC)

            val captor = argumentCaptor<User>()
            verify(userRepository).save(captor.capture())
            assertEquals(SubscriptionTier.BASIC, captor.firstValue.subscriptionTier)
        }

        @Test
        fun `upgradeSubscription returns user with updated tier`() {
            val existing = makeUser(tier = SubscriptionTier.TRIAL)
            whenever(userRepository.findById(1L)).thenReturn(java.util.Optional.of(existing))
            doAnswer { it.arguments[0] }.whenever(userRepository).save(anyOrNull())

            val result = service.upgradeSubscription(1L, SubscriptionTier.PREMIUM)

            assertEquals(SubscriptionTier.PREMIUM, result.subscriptionTier)
        }

        @Test
        fun `upgradeSubscription does not change other user fields`() {
            val existing = makeUser(tier = SubscriptionTier.TRIAL, sport = Sport.BASKETBALL, position = Position.PG)
            whenever(userRepository.findById(1L)).thenReturn(java.util.Optional.of(existing))
            doAnswer { it.arguments[0] }.whenever(userRepository).save(anyOrNull())

            val result = service.upgradeSubscription(1L, SubscriptionTier.BASIC)

            assertEquals(Sport.BASKETBALL, result.primarySport)
            assertEquals(Position.PG, result.primaryPosition)
            assertEquals("test@test.com", result.email)
        }

        @Test
        fun `upgradeSubscription throws for unknown userId`() {
            whenever(userRepository.findById(999L)).thenReturn(java.util.Optional.empty())

            org.junit.jupiter.api.assertThrows<IllegalArgumentException> {
                service.upgradeSubscription(999L, SubscriptionTier.BASIC)
            }
        }

        @Test
        fun `upgradeSubscription updates updatedAt timestamp`() {
            val before = LocalDateTime.now().minusMinutes(5)
            val existing = makeUser(tier = SubscriptionTier.TRIAL).copy(updatedAt = before)
            whenever(userRepository.findById(1L)).thenReturn(java.util.Optional.of(existing))
            doAnswer { it.arguments[0] }.whenever(userRepository).save(anyOrNull())

            val captor = argumentCaptor<User>()
            service.upgradeSubscription(1L, SubscriptionTier.BASIC)
            verify(userRepository).save(captor.capture())

            assertTrue(captor.firstValue.updatedAt.isAfter(before))
        }

        @Test
        fun `TRIAL to BASIC upgrade succeeds`() {
            val existing = makeUser(tier = SubscriptionTier.TRIAL)
            whenever(userRepository.findById(1L)).thenReturn(java.util.Optional.of(existing))
            doAnswer { it.arguments[0] }.whenever(userRepository).save(anyOrNull())

            val result = service.upgradeSubscription(1L, SubscriptionTier.BASIC)
            assertEquals(SubscriptionTier.BASIC, result.subscriptionTier)
        }

        @Test
        fun `BASIC to PREMIUM upgrade succeeds`() {
            val existing = makeUser(tier = SubscriptionTier.BASIC)
            whenever(userRepository.findById(1L)).thenReturn(java.util.Optional.of(existing))
            doAnswer { it.arguments[0] }.whenever(userRepository).save(anyOrNull())

            val result = service.upgradeSubscription(1L, SubscriptionTier.PREMIUM)
            assertEquals(SubscriptionTier.PREMIUM, result.subscriptionTier)
        }

        @Test
        fun `PREMIUM to NONE downgrade succeeds`() {
            val existing = makeUser(tier = SubscriptionTier.PREMIUM)
            whenever(userRepository.findById(1L)).thenReturn(java.util.Optional.of(existing))
            doAnswer { it.arguments[0] }.whenever(userRepository).save(anyOrNull())

            val result = service.upgradeSubscription(1L, SubscriptionTier.NONE)
            assertEquals(SubscriptionTier.NONE, result.subscriptionTier)
        }
    }

    // =========================================================================
    // GET /users/{userId}
    // =========================================================================

    @Nested
    inner class GetUserProfileTests {

        @Test
        fun `returns 200 with profile for known user`() {
            val user = makeUser(tier = SubscriptionTier.BASIC)
            whenever(userService.findById(1L)).thenReturn(user)

            val response = controller.getUserProfile(1L)

            assertEquals(HttpStatus.OK, response.statusCode)
            assertEquals("BASIC", response.body!!.subscriptionTier)
        }

        @Test
        fun `returns 404 for unknown user`() {
            whenever(userService.findById(999L)).thenThrow(IllegalArgumentException("User not found: 999"))

            val response = controller.getUserProfile(999L)

            assertEquals(HttpStatus.NOT_FOUND, response.statusCode)
        }

        @Test
        fun `response sport and position are enum name strings`() {
            val user = makeUser(sport = Sport.BASKETBALL, position = Position.PG)
            whenever(userService.findById(1L)).thenReturn(user)

            val body = controller.getUserProfile(1L).body!!
            assertEquals("BASKETBALL", body.primarySport)
            assertEquals("PG", body.primaryPosition)
        }
    }

    // =========================================================================
    // GET /users/firebase/{firebaseUid}
    // =========================================================================

    @Nested
    inner class GetUserByFirebaseUidTests {

        @Test
        fun `returns 200 for known firebase UID`() {
            val user = makeUser()
            whenever(userService.findByFirebaseUid("uid-1")).thenReturn(user)

            val response = controller.getUserByFirebaseUid("uid-1")

            assertEquals(HttpStatus.OK, response.statusCode)
        }

        @Test
        fun `returns 404 for unknown firebase UID`() {
            whenever(userService.findByFirebaseUid("unknown")).thenReturn(null)

            val response = controller.getUserByFirebaseUid("unknown")

            assertEquals(HttpStatus.NOT_FOUND, response.statusCode)
        }
    }

    // =========================================================================
    // GENERAL_FITNESS profile responses and fitnessGoals persistence
    // =========================================================================

    @Nested
    inner class GeneralFitnessUserProfileTests {

        @Test
        fun `GENERAL_FITNESS user profile returns sport as GENERAL_FITNESS string`() {
            val user = makeUser(sport = Sport.GENERAL_FITNESS, position = null)
            whenever(userService.findById(1L)).thenReturn(user)

            val body = controller.getUserProfile(1L).body!!
            assertEquals("GENERAL_FITNESS", body.primarySport)
        }

        @Test
        fun `GENERAL_FITNESS user profile returns null primaryPosition`() {
            val user = makeUser(sport = Sport.GENERAL_FITNESS, position = null)
            whenever(userService.findById(1L)).thenReturn(user)

            val body = controller.getUserProfile(1L).body!!
            assertNull(body.primaryPosition)
        }

        @Test
        fun `GENERAL_FITNESS user profile includes fitnessGoals`() {
            val user = makeUser(
                sport = Sport.GENERAL_FITNESS,
                position = null,
                fitnessGoals = "Lose Weight,Increase Strength & Muscle Mass"
            )
            whenever(userService.findById(1L)).thenReturn(user)

            val body = controller.getUserProfile(1L).body!!
            assertEquals(
                listOf("Lose Weight", "Increase Strength & Muscle Mass"),
                body.fitnessGoals
            )
        }

        @Test
        fun `updateUserProfile saves fitnessGoals for GENERAL_FITNESS user`() {
            val updated = makeUser(
                sport = Sport.GENERAL_FITNESS,
                position = null,
                fitnessGoals = "Lose Weight,Increase Strength & Muscle Mass"
            )
            whenever(userService.updateUserProfile(
                any(), anyOrNull(), anyOrNull(), anyOrNull(),
                anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull()
            )).thenReturn(updated)

            val request = UserProfileUpdateRequest(
                displayName = null,
                primarySport = "GENERAL_FITNESS",
                primaryPosition = null,
                age = null,
                fitnessGoals = listOf("Lose Weight", "Increase Strength & Muscle Mass")
            )

            val response = controller.updateUserProfile(1L, request)

            assertEquals(HttpStatus.OK, response.statusCode)

            val captor = argumentCaptor<List<String>>()
            verify(userService).updateUserProfile(
                eq(1L), anyOrNull(), anyOrNull(), anyOrNull(),
                anyOrNull(), anyOrNull(), anyOrNull(), captor.capture()
            )
            assertEquals(
                listOf("Lose Weight", "Increase Strength & Muscle Mass"),
                captor.firstValue
            )
        }
    }
}