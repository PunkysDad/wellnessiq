package com.gameiq.service

import com.gameiq.controller.TaggedConversationResponse
import com.gameiq.controller.TaggedWorkoutResponse
import com.gameiq.entity.ConversationTag
import com.gameiq.entity.Tag
import com.gameiq.entity.WorkoutPlanTag
import com.gameiq.entity.SubscriptionTier
import com.gameiq.repository.ClaudeConversationRepository
import com.gameiq.repository.ConversationTagRepository
import com.gameiq.repository.TagRepository
import com.gameiq.repository.UserRepository
import com.gameiq.repository.WorkoutPlanRepository
import com.gameiq.repository.WorkoutPlanTagRepository
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
@Transactional
class TagService @Autowired constructor(
    private val tagRepository: TagRepository,
    private val userRepository: UserRepository,
    private val conversationTagRepository: ConversationTagRepository,
    private val claudeConversationRepository: ClaudeConversationRepository,
    private val workoutPlanTagRepository: WorkoutPlanTagRepository,
    private val workoutPlanRepository: WorkoutPlanRepository
) {

    // -------------------------------------------------------------------------
    // Tag CRUD
    // -------------------------------------------------------------------------

    fun getUserTags(userId: Long): List<Tag> {
        val user = userRepository.findById(userId)
            .orElseThrow { IllegalArgumentException("User not found: $userId") }
        if (user.subscriptionTier == SubscriptionTier.NONE ||
            user.subscriptionTier == SubscriptionTier.BASIC) {
            return emptyList()
        }
        return tagRepository.findByUserIdOrderByNameAsc(userId)
    }

    fun createTag(userId: Long, name: String, color: String = "#007AFF"): Tag {
        val user = userRepository.findById(userId)
            .orElseThrow { IllegalArgumentException("User not found: $userId") }

        if (user.subscriptionTier != SubscriptionTier.PREMIUM &&
            user.subscriptionTier != SubscriptionTier.TRIAL) {
            throw IllegalStateException(
                "Tagging is a Premium feature. Upgrade to Premium (\$19.99/mo) to organize your content with tags."
            )
        }

        if (tagRepository.existsByUserIdAndNameIgnoreCase(userId, name.trim())) {
            throw IllegalArgumentException("Tag '${name.trim()}' already exists for this user")
        }

        val trimmedName = name.trim()
        require(trimmedName.isNotEmpty() && trimmedName.length <= 100) {
            "Tag name must be between 1 and 100 characters"
        }
        require(color.matches(Regex("^#[0-9A-Fa-f]{6}$"))) {
            "Color must be a valid hex color (e.g., #FF5733)"
        }

        return tagRepository.save(
            Tag(
                user = userRepository.getReferenceById(userId),
                name = trimmedName,
                color = color.uppercase(),
                createdAt = LocalDateTime.now(),
                updatedAt = LocalDateTime.now()
            )
        )
    }

    fun updateTag(userId: Long, tagId: Long, newName: String?, newColor: String?): Tag {
        val tag = tagRepository.findById(tagId)
            .orElseThrow { IllegalArgumentException("Tag not found: $tagId") }
        require(tag.user.id == userId) { "Tag does not belong to user $userId" }

        val updatedName = if (newName != null) {
            val trimmed = newName.trim()
            require(trimmed.isNotEmpty() && trimmed.length <= 100) {
                "Tag name must be between 1 and 100 characters"
            }
            val existing = tagRepository.findByUserIdAndNameIgnoreCase(userId, trimmed)
            require(existing == null || existing.id == tagId) {
                "Tag '$trimmed' already exists for this user"
            }
            trimmed
        } else tag.name

        val updatedColor = if (newColor != null) {
            require(newColor.matches(Regex("^#[0-9A-Fa-f]{6}$"))) {
                "Color must be a valid hex color (e.g., #FF5733)"
            }
            newColor.uppercase()
        } else tag.color

        return tagRepository.save(
            tag.copy(name = updatedName, color = updatedColor, updatedAt = LocalDateTime.now())
        )
    }

    fun deleteTag(userId: Long, tagId: Long) {
        val tag = tagRepository.findById(tagId)
            .orElseThrow { IllegalArgumentException("Tag not found: $tagId") }
        require(tag.user.id == userId) { "Tag does not belong to user $userId" }
        tagRepository.delete(tag)
    }

    fun searchTags(userId: Long, searchTerm: String): List<Tag> =
        tagRepository.searchByUserIdAndName(userId, searchTerm.trim())

    fun getTagById(userId: Long, tagId: Long): Tag? {
        val tag = tagRepository.findById(tagId).orElse(null)
        return if (tag?.user?.id == userId) tag else null
    }

    fun getOrCreateTag(userId: Long, name: String, color: String = "#007AFF"): Tag =
        tagRepository.findByUserIdAndNameIgnoreCase(userId, name.trim())
            ?: createTag(userId, name, color)

    // -------------------------------------------------------------------------
    // Tagged content — used by the Tags screen
    // -------------------------------------------------------------------------

    fun getConversationsByTag(userId: Long, tagId: Long): List<TaggedConversationResponse> {
        val links = conversationTagRepository.findByTagId(tagId)
        if (links.isEmpty()) return emptyList()

        return claudeConversationRepository.findAllById(links.map { it.conversationId })
            .filter { it.user.id == userId }
            .sortedByDescending { it.createdAt }
            .map { conv ->
                TaggedConversationResponse(
                    id = conv.id,
                    title = extractConversationTitle(conv.userMessage),
                    conversationType = conv.conversationType.name,
                    createdAt = conv.createdAt.toString()
                )
            }
    }

    fun getWorkoutsByTag(userId: Long, tagId: Long): List<TaggedWorkoutResponse> {
        val links = workoutPlanTagRepository.findByTagId(tagId)
        if (links.isEmpty()) return emptyList()

        return workoutPlanRepository.findAllById(links.map { it.workoutPlanId })
            .filter { it.user.id == userId }
            .sortedByDescending { it.createdAt }
            .map { plan ->
                TaggedWorkoutResponse(
                    id = plan.id,
                    title = plan.workoutName
                        ?: "${plan.position?.name ?: ""} ${plan.sport.name} workout",
                    sport = plan.sport.name,
                    position = plan.position?.name ?: "",
                    createdAt = plan.createdAt.toString()
                )
            }
    }

    // -------------------------------------------------------------------------
    // Tag assignment — workouts
    // -------------------------------------------------------------------------

    fun addTagToWorkoutPlan(userId: Long, workoutPlanId: Long, tagId: Long) {
        val user = userRepository.findById(userId)
            .orElseThrow { IllegalArgumentException("User not found: $userId") }
        if (user.subscriptionTier != SubscriptionTier.PREMIUM &&
            user.subscriptionTier != SubscriptionTier.TRIAL) {
            throw IllegalStateException(
                "Tagging is a Premium feature. Upgrade to Premium (\$19.99/mo) to organize your content with tags."
            )
        }

        val tag = tagRepository.findById(tagId)
            .orElseThrow { IllegalArgumentException("Tag not found: $tagId") }
        require(tag.user.id == userId) { "Tag does not belong to user $userId" }

        val workout = workoutPlanRepository.findById(workoutPlanId)
            .orElseThrow { IllegalArgumentException("Workout plan not found: $workoutPlanId") }
        require(workout.user.id == userId) { "Workout plan does not belong to user $userId" }

        if (workoutPlanTagRepository.existsByWorkoutPlanIdAndTagId(workoutPlanId, tagId)) return

        workoutPlanTagRepository.save(WorkoutPlanTag(workoutPlanId = workoutPlanId, tagId = tagId))
    }

    fun removeTagFromWorkoutPlan(userId: Long, workoutPlanId: Long, tagId: Long) {
        val tag = tagRepository.findById(tagId)
            .orElseThrow { IllegalArgumentException("Tag not found: $tagId") }
        require(tag.user.id == userId) { "Tag does not belong to user $userId" }

        workoutPlanTagRepository.deleteByWorkoutPlanIdAndTagId(workoutPlanId, tagId)
    }

    // -------------------------------------------------------------------------
    // Tag assignment — conversations
    // -------------------------------------------------------------------------

    fun addTagToConversation(userId: Long, conversationId: Long, tagId: Long) {
        val user = userRepository.findById(userId)
            .orElseThrow { IllegalArgumentException("User not found: $userId") }
        if (user.subscriptionTier != SubscriptionTier.PREMIUM &&
            user.subscriptionTier != SubscriptionTier.TRIAL) {
            throw IllegalStateException(
                "Tagging is a Premium feature. Upgrade to Premium (\$19.99/mo) to organize your content with tags."
            )
        }

        val tag = tagRepository.findById(tagId)
            .orElseThrow { IllegalArgumentException("Tag not found: $tagId") }
        require(tag.user.id == userId) { "Tag does not belong to user $userId" }

        val conversation = claudeConversationRepository.findById(conversationId)
            .orElseThrow { IllegalArgumentException("Conversation not found: $conversationId") }
        require(conversation.user.id == userId) { "Conversation does not belong to user $userId" }

        if (conversationTagRepository.existsByConversationIdAndTagId(conversationId, tagId)) return

        conversationTagRepository.save(ConversationTag(conversationId = conversationId, tagId = tagId))
    }

    fun removeTagFromConversation(userId: Long, conversationId: Long, tagId: Long) {
        val tag = tagRepository.findById(tagId)
            .orElseThrow { IllegalArgumentException("Tag not found: $tagId") }
        require(tag.user.id == userId) { "Tag does not belong to user $userId" }

        conversationTagRepository.deleteByConversationIdAndTagId(conversationId, tagId)
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private fun extractConversationTitle(userMessage: String): String {
        val marker = "question:"
        val idx = userMessage.indexOf(marker, ignoreCase = true)
        return if (idx != -1) {
            userMessage.substring(idx + marker.length).trim()
        } else {
            userMessage.trim()
        }
    }
}