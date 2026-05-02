package com.gameiq.service

import com.gameiq.entity.*
import com.gameiq.repository.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.*
import java.time.LocalDateTime
import java.util.*

class TagServiceTest {

    private val tagRepository: TagRepository = mock()
    private val userRepository: UserRepository = mock()
    private val conversationTagRepository: ConversationTagRepository = mock()
    private val claudeConversationRepository: ClaudeConversationRepository = mock()
    private val workoutPlanTagRepository: WorkoutPlanTagRepository = mock()
    private val workoutPlanRepository: WorkoutPlanRepository = mock()

    private lateinit var service: TagService

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private fun makeUser(
        id: Long = 1L,
        tier: SubscriptionTier = SubscriptionTier.PREMIUM
    ) = User(
        id = id,
        email = "test@test.com",
        firebaseUid = "uid-$id",
        displayName = "Test User",
        subscriptionTier = tier,
        createdAt = LocalDateTime.now(),
        updatedAt = LocalDateTime.now()
    )

    private fun makeTag(
        id: Long = 1L,
        user: User = makeUser(),
        name: String = "Footwork",
        color: String = "#007AFF"
    ) = Tag(
        id = id,
        user = user,
        name = name,
        color = color,
        createdAt = LocalDateTime.now(),
        updatedAt = LocalDateTime.now()
    )

    @BeforeEach
    fun setUp() {
        service = TagService(
            tagRepository = tagRepository,
            userRepository = userRepository,
            conversationTagRepository = conversationTagRepository,
            claudeConversationRepository = claudeConversationRepository,
            workoutPlanTagRepository = workoutPlanTagRepository,
            workoutPlanRepository = workoutPlanRepository
        )
    }

    // =========================================================================
    // getUserTags — Premium enforcement
    // =========================================================================

    @Nested
    inner class GetUserTagsTests {

        @Test
        fun `PREMIUM user gets their tags`() {
            val user = makeUser(tier = SubscriptionTier.PREMIUM)
            val tags = listOf(makeTag(name = "Footwork"), makeTag(id = 2L, name = "Strength"))
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(tagRepository.findByUserIdOrderByNameAsc(1L)).thenReturn(tags)

            val result = service.getUserTags(1L)

            assertEquals(2, result.size)
        }

        @Test
        fun `BASIC user gets empty list`() {
            val user = makeUser(tier = SubscriptionTier.BASIC)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))

            val result = service.getUserTags(1L)

            assertTrue(result.isEmpty())
            verify(tagRepository, never()).findByUserIdOrderByNameAsc(any())
        }

        @Test
        fun `TRIAL user gets their tags`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL)
            val tags = listOf(makeTag(name = "Footwork"), makeTag(id = 2L, name = "Strength"))
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(tagRepository.findByUserIdOrderByNameAsc(1L)).thenReturn(tags)

            val result = service.getUserTags(1L)

            assertEquals(2, result.size)
        }

        @Test
        fun `NONE user gets empty list`() {
            val user = makeUser(tier = SubscriptionTier.NONE)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))

            val result = service.getUserTags(1L)

            assertTrue(result.isEmpty())
        }

        @Test
        fun `downgraded user sees empty list but tags preserved in DB`() {
            // Simulates a user who was PREMIUM, had tags, then downgraded to BASIC
            val user = makeUser(tier = SubscriptionTier.BASIC)
            val existingTags = listOf(makeTag(name = "Old tag"))
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            // Tags exist in DB but should not be returned
            whenever(tagRepository.findByUserIdOrderByNameAsc(1L)).thenReturn(existingTags)

            val result = service.getUserTags(1L)

            assertTrue(result.isEmpty())
            verify(tagRepository, never()).findByUserIdOrderByNameAsc(any())
        }

        @Test
        fun `getUserTags throws for unknown user`() {
            whenever(userRepository.findById(999L)).thenReturn(Optional.empty())

            assertThrows<IllegalArgumentException> {
                service.getUserTags(999L)
            }
        }
    }

    // =========================================================================
    // createTag — Premium enforcement
    // =========================================================================

    @Nested
    inner class CreateTagTests {

        @Test
        fun `PREMIUM user can create a tag`() {
            val user = makeUser(tier = SubscriptionTier.PREMIUM)
            val savedTag = makeTag(name = "Footwork")
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(tagRepository.existsByUserIdAndNameIgnoreCase(1L, "Footwork")).thenReturn(false)
            whenever(userRepository.getReferenceById(1L)).thenReturn(user)
            doReturn(savedTag).whenever(tagRepository).save(anyOrNull())

            val result = service.createTag(1L, "Footwork", "#007AFF")

            assertEquals("Footwork", result.name)
        }

        @Test
        fun `BASIC user cannot create a tag`() {
            val user = makeUser(tier = SubscriptionTier.BASIC)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))

            val ex = assertThrows<IllegalStateException> {
                service.createTag(1L, "Footwork")
            }
            assertTrue(ex.message!!.contains("Premium"))
        }

        @Test
        fun `TRIAL user can create a tag`() {
            val user = makeUser(tier = SubscriptionTier.TRIAL)
            val savedTag = makeTag(name = "Footwork")
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(tagRepository.existsByUserIdAndNameIgnoreCase(1L, "Footwork")).thenReturn(false)
            whenever(userRepository.getReferenceById(1L)).thenReturn(user)
            doReturn(savedTag).whenever(tagRepository).save(anyOrNull())

            val result = service.createTag(1L, "Footwork")

            assertEquals("Footwork", result.name)
        }

        @Test
        fun `NONE user cannot create a tag`() {
            val user = makeUser(tier = SubscriptionTier.NONE)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))

            assertThrows<IllegalStateException> {
                service.createTag(1L, "Footwork")
            }
        }

        @Test
        fun `non-Premium error message contains upgrade pricing`() {
            val user = makeUser(tier = SubscriptionTier.BASIC)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))

            val ex = assertThrows<IllegalStateException> {
                service.createTag(1L, "Footwork")
            }
            assertTrue(ex.message!!.contains("19.99"))
        }

        @Test
        fun `PREMIUM user cannot create duplicate tag name`() {
            val user = makeUser(tier = SubscriptionTier.PREMIUM)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(tagRepository.existsByUserIdAndNameIgnoreCase(1L, "Footwork")).thenReturn(true)

            assertThrows<IllegalArgumentException> {
                service.createTag(1L, "Footwork")
            }
        }

        @Test
        fun `tag name is trimmed before saving`() {
            val user = makeUser(tier = SubscriptionTier.PREMIUM)
            val savedTag = makeTag(name = "Footwork")
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(tagRepository.existsByUserIdAndNameIgnoreCase(1L, "Footwork")).thenReturn(false)
            whenever(userRepository.getReferenceById(1L)).thenReturn(user)

            val captor = argumentCaptor<Tag>()
            doReturn(savedTag).whenever(tagRepository).save(captor.capture())

            service.createTag(1L, "  Footwork  ", "#007AFF")

            assertEquals("Footwork", captor.firstValue.name)
        }

        @Test
        fun `color is uppercased before saving`() {
            val user = makeUser(tier = SubscriptionTier.PREMIUM)
            val savedTag = makeTag(color = "#FF5733")
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(tagRepository.existsByUserIdAndNameIgnoreCase(1L, "Speed")).thenReturn(false)
            whenever(userRepository.getReferenceById(1L)).thenReturn(user)

            val captor = argumentCaptor<Tag>()
            doReturn(savedTag).whenever(tagRepository).save(captor.capture())

            service.createTag(1L, "Speed", "#ff5733")

            assertEquals("#FF5733", captor.firstValue.color)
        }

        @Test
        fun `invalid hex color throws`() {
            val user = makeUser(tier = SubscriptionTier.PREMIUM)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(tagRepository.existsByUserIdAndNameIgnoreCase(1L, "Speed")).thenReturn(false)

            assertThrows<IllegalArgumentException> {
                service.createTag(1L, "Speed", "blue")
            }
        }

        @Test
        fun `empty tag name throws`() {
            val user = makeUser(tier = SubscriptionTier.PREMIUM)
            whenever(userRepository.findById(1L)).thenReturn(Optional.of(user))
            whenever(tagRepository.existsByUserIdAndNameIgnoreCase(1L, "")).thenReturn(false)

            assertThrows<IllegalArgumentException> {
                service.createTag(1L, "   ")
            }
        }

        @Test
        fun `createTag throws for unknown user`() {
            whenever(userRepository.findById(999L)).thenReturn(Optional.empty())

            assertThrows<IllegalArgumentException> {
                service.createTag(999L, "Footwork")
            }
        }
    }

    // =========================================================================
    // deleteTag
    // =========================================================================

    @Nested
    inner class DeleteTagTests {

        @Test
        fun `owner can delete their tag`() {
            val user = makeUser()
            val tag = makeTag(user = user)
            whenever(tagRepository.findById(1L)).thenReturn(Optional.of(tag))

            assertDoesNotThrow { service.deleteTag(1L, 1L) }
            verify(tagRepository).delete(tag)
        }

        @Test
        fun `cannot delete another user's tag`() {
            val owner = makeUser(id = 1L)
            val other = makeUser(id = 2L)
            val tag = makeTag(user = owner)
            whenever(tagRepository.findById(1L)).thenReturn(Optional.of(tag))

            assertThrows<IllegalArgumentException> {
                service.deleteTag(other.id, 1L)
            }
            verify(tagRepository, never()).delete(any())
        }

        @Test
        fun `deleteTag throws for unknown tag`() {
            whenever(tagRepository.findById(999L)).thenReturn(Optional.empty())

            assertThrows<IllegalArgumentException> {
                service.deleteTag(1L, 999L)
            }
        }
    }

    // =========================================================================
    // updateTag
    // =========================================================================

    @Nested
    inner class UpdateTagTests {

        @Test
        fun `owner can update name`() {
            val user = makeUser()
            val tag = makeTag(user = user, name = "Old")
            whenever(tagRepository.findById(1L)).thenReturn(Optional.of(tag))
            whenever(tagRepository.findByUserIdAndNameIgnoreCase(1L, "New")).thenReturn(null)
            doAnswer { it.arguments[0] }.whenever(tagRepository).save(anyOrNull())

            val result = service.updateTag(1L, 1L, "New", null)

            assertEquals("New", result.name)
        }

        @Test
        fun `cannot update another user's tag`() {
            val owner = makeUser(id = 1L)
            val tag = makeTag(user = owner)
            whenever(tagRepository.findById(1L)).thenReturn(Optional.of(tag))

            assertThrows<IllegalArgumentException> {
                service.updateTag(2L, 1L, "New", null)
            }
        }

        @Test
        fun `updateTag throws for unknown tag`() {
            whenever(tagRepository.findById(999L)).thenReturn(Optional.empty())

            assertThrows<IllegalArgumentException> {
                service.updateTag(1L, 999L, "New", null)
            }
        }
    }
}