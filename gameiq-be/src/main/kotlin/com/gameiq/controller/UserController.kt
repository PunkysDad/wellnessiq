package com.gameiq.controller

import com.gameiq.entity.User
import com.gameiq.entity.Sport
import com.gameiq.entity.Position
import com.gameiq.entity.SubscriptionTier
import com.gameiq.service.UserService
import com.gameiq.service.ClaudeService
import com.gameiq.service.WorkoutService
import com.gameiq.repository.ClaudeConversationRepository
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.http.HttpStatus
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit

data class UserProfileResponse(
    val id: Long,
    val firebaseUid: String,
    val email: String?,
    val displayName: String?,
    val subscriptionTier: String,
    val primarySport: String?,
    val primaryPosition: String?,
    val createdAt: String,
    val isActive: Boolean,
    val fitnessGoals: List<String>? = null
)

data class UserProfileUpdateRequest(
    val displayName: String?,
    val primarySport: String?,
    val primaryPosition: String?,
    val age: Int?,
    val fitnessGoals: List<String>? = null
)

data class FitnessGoalsUpdateRequest(
    val fitnessGoals: List<String>
)

data class UserCreateRequest(
    val email: String,
    val firebaseUid: String,
    val displayName: String,
    val primarySport: String?,
    val primaryPosition: String?,
    val age: Int?,
    val subscriptionTier: String?,
    val billingCycle: String?,
    val firstName: String?,
    val lastName: String?
)

data class UserStatsResponse(
    val totalQuizzes: Long,
    val averageScore: Double,
    val totalConversations: Long,
    val totalWorkouts: Long,
    val daysSinceLastActivity: Int,
    val currentStreak: Int
)


data class SubscriptionUpdateRequest(
    val subscriptionTier: String
)

@RestController
@RequestMapping("/users")
@CrossOrigin(origins = ["http://localhost:3000", "http://localhost:19006"])
class UserController(
    private val userService: UserService,
    private val claudeService: ClaudeService,
    private val workoutService: WorkoutService,
    private val claudeConversationRepository: ClaudeConversationRepository
) {
    
    @PostMapping
    fun createUser(@RequestBody createRequest: UserCreateRequest): ResponseEntity<UserProfileResponse> {
        return try {
            // Convert string sport/position to enums
            val sport = createRequest.primarySport?.let { 
                try { Sport.valueOf(it.uppercase()) } catch (e: Exception) { null }
            }
            val position = createRequest.primaryPosition?.let {
                try { Position.valueOf(it.uppercase()) } catch (e: Exception) { null }
            }
            
            val user = userService.createUser(
                email = createRequest.email,
                firebaseUid = createRequest.firebaseUid,
                displayName = createRequest.displayName,
                firstName = createRequest.firstName,
                lastName = createRequest.lastName
            )
            
            // Update with profile info (without subscription)
            var updatedUser = if (sport != null || position != null || createRequest.age != null) {
                userService.updateUserProfile(
                    userId = user.id,
                    displayName = user.displayName,
                    primarySport = sport,
                    primaryPosition = position,
                    age = createRequest.age
                )
            } else user
            
            // Handle subscription tier if provided using existing subscription logic
            if (createRequest.subscriptionTier != null) {
                val subscriptionTier = try {
                    SubscriptionTier.valueOf(createRequest.subscriptionTier.uppercase())
                } catch (e: Exception) {
                    SubscriptionTier.NONE
                }
                
                // Use the existing upgradeSubscription method
                if (subscriptionTier != SubscriptionTier.NONE) {
                    updatedUser = userService.upgradeSubscription(user.id, subscriptionTier)
                }
            }
            
            val response = UserProfileResponse(
                id = updatedUser.id,
                firebaseUid = updatedUser.firebaseUid,
                email = updatedUser.email,
                displayName = updatedUser.displayName,
                subscriptionTier = updatedUser.subscriptionTier.name,
                primarySport = updatedUser.primarySport?.name,
                primaryPosition = updatedUser.primaryPosition?.name,
                createdAt = updatedUser.createdAt.toString(),
                isActive = updatedUser.isActive,
                fitnessGoals = updatedUser.getFitnessGoalsList()
            )
            ResponseEntity.status(HttpStatus.CREATED).body(response)
        } catch (e: Exception) {
            println("Error creating user: ${e.message}")
            e.printStackTrace()
            ResponseEntity.badRequest().build()
        }
    }
    
    @GetMapping("/{userId}")
    fun getUserProfile(@PathVariable userId: Long): ResponseEntity<UserProfileResponse> {
        return try {
            val user = userService.findById(userId) ?: return ResponseEntity.notFound().build()
            val response = UserProfileResponse(
                id = user.id,
                firebaseUid = user.firebaseUid,
                email = user.email,
                displayName = user.displayName,
                subscriptionTier = user.subscriptionTier.name,
                primarySport = user.primarySport?.name,
                primaryPosition = user.primaryPosition?.name,
                createdAt = user.createdAt.toString(),
                isActive = user.isActive,
                fitnessGoals = user.getFitnessGoalsList()
            )
            ResponseEntity.ok(response)
        } catch (e: Exception) {
            ResponseEntity.notFound().build()
        }
    }

    @GetMapping("/firebase/{firebaseUid}")
    fun getUserByFirebaseUid(@PathVariable firebaseUid: String): ResponseEntity<UserProfileResponse> {
        return try {
            val user = userService.findByFirebaseUid(firebaseUid) ?: return ResponseEntity.notFound().build()
            val response = UserProfileResponse(
                id = user.id,
                firebaseUid = user.firebaseUid,
                email = user.email,
                displayName = user.displayName,
                subscriptionTier = user.subscriptionTier.name,
                primarySport = user.primarySport?.name,
                primaryPosition = user.primaryPosition?.name,
                createdAt = user.createdAt.toString(),
                isActive = user.isActive,
                fitnessGoals = user.getFitnessGoalsList()
            )
            ResponseEntity.ok(response)
        } catch (e: Exception) {
            ResponseEntity.notFound().build()
        }
    }
    
    @PutMapping("/{userId}")
    fun updateUserProfile(
        @PathVariable userId: Long,
        @RequestBody updateRequest: UserProfileUpdateRequest
    ): ResponseEntity<UserProfileResponse> {
        return try {
            // Convert string sport/position to enums
            val sport = updateRequest.primarySport?.let { 
                try { Sport.valueOf(it.uppercase()) } catch (e: Exception) { null }
            }
            val position = updateRequest.primaryPosition?.let {
                try { Position.valueOf(it.uppercase()) } catch (e: Exception) { null }
            }
            
            val updatedUser = userService.updateUserProfile(
                userId = userId,
                displayName = updateRequest.displayName,
                primarySport = sport,
                primaryPosition = position,
                age = updateRequest.age,
                fitnessGoals = updateRequest.fitnessGoals
            )

            val response = UserProfileResponse(
                id = updatedUser.id,
                firebaseUid = updatedUser.firebaseUid,
                email = updatedUser.email,
                displayName = updatedUser.displayName,
                subscriptionTier = updatedUser.subscriptionTier.name,
                primarySport = updatedUser.primarySport?.name,
                primaryPosition = updatedUser.primaryPosition?.name,
                createdAt = updatedUser.createdAt.toString(),
                isActive = updatedUser.isActive,
                fitnessGoals = updatedUser.getFitnessGoalsList()
            )
            ResponseEntity.ok(response)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @PutMapping("/{userId}/fitness-goals")
    fun updateFitnessGoals(
        @PathVariable userId: Long,
        @RequestBody request: FitnessGoalsUpdateRequest
    ): ResponseEntity<UserProfileResponse> {
        return try {
            val updatedUser = userService.updateFitnessGoals(userId, request.fitnessGoals)
            val response = UserProfileResponse(
                id = updatedUser.id,
                firebaseUid = updatedUser.firebaseUid,
                email = updatedUser.email,
                displayName = updatedUser.displayName,
                subscriptionTier = updatedUser.subscriptionTier.name,
                primarySport = updatedUser.primarySport?.name,
                primaryPosition = updatedUser.primaryPosition?.name,
                createdAt = updatedUser.createdAt.toString(),
                isActive = updatedUser.isActive,
                fitnessGoals = updatedUser.getFitnessGoalsList()
            )
            ResponseEntity.ok(response)
        } catch (e: Exception) {
            ResponseEntity.badRequest().build()
        }
    }

    @GetMapping("/{userId}/stats")
    fun getUserStats(@PathVariable userId: Long): ResponseEntity<UserStatsResponse> {
        return try {
            // Get actual conversation count from ClaudeService
            val conversationCount = claudeConversationRepository.countChatConversationsByUserId(userId)
            
            // Get actual workout count from WorkoutService
            val workoutCount = workoutService.getUserWorkoutPlans(userId).size.toLong()
            
            // Calculate days since last activity
            val conversations = claudeService.getUserConversations(userId)
            val workouts = workoutService.getUserWorkoutPlans(userId)
            
            val lastConversationDate = conversations.maxByOrNull { it.createdAt }?.createdAt
            val lastWorkoutDate = workouts.maxByOrNull { it.createdAt }?.createdAt
            
            val mostRecentActivity = listOfNotNull(lastConversationDate, lastWorkoutDate)
                .maxByOrNull { it } ?: LocalDateTime.now()
            
            val daysSinceLastActivity = ChronoUnit.DAYS.between(mostRecentActivity, LocalDateTime.now()).toInt()
            
            val stats = UserStatsResponse(
                totalQuizzes = 0L, // Keep as 0 since we're not using quizzes for now
                averageScore = 0.0, // Keep as 0 since we're not using quizzes for now
                totalConversations = conversationCount,
                totalWorkouts = workoutCount,
                daysSinceLastActivity = daysSinceLastActivity,
                currentStreak = 0 // Can implement later
            )
            
            ResponseEntity.ok(stats)
        } catch (e: Exception) {
            println("Error getting user stats for userId $userId: ${e.message}")
            // Return empty stats on error instead of 404
            val emptyStats = UserStatsResponse(
                totalQuizzes = 0L,
                averageScore = 0.0,
                totalConversations = 0L,
                totalWorkouts = 0L,
                daysSinceLastActivity = 0,
                currentStreak = 0
            )
            ResponseEntity.ok(emptyStats)
        }
    }

    @PutMapping("/{userId}/subscription")
    fun updateSubscriptionTier(
        @PathVariable userId: Long,
        @RequestBody request: SubscriptionUpdateRequest
    ): ResponseEntity<Map<String, Any>> {
        return try {
            val subscriptionTier = try {
                SubscriptionTier.valueOf(request.subscriptionTier.uppercase())
            } catch (e: Exception) {
                return ResponseEntity.badRequest().body(mapOf(
                    "success" to false,
                    "message" to "Invalid subscription tier: ${request.subscriptionTier}"
                ))
            }

            val updatedUser = userService.upgradeSubscription(userId, subscriptionTier)
            ResponseEntity.ok(mapOf(
                "success" to true,
                "message" to "Subscription updated to ${request.subscriptionTier}",
                "newTier" to updatedUser.subscriptionTier.name
            ))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf(
                "success" to false,
                "message" to e.message.orEmpty()
            ))
        }
    }
    
    @PostMapping("/{userId}/subscription")
    fun updateSubscription(
        @PathVariable userId: Long,
        @RequestParam tier: String
    ): ResponseEntity<Map<String, Any>> {
        return try {
            // Convert string to SubscriptionTier enum
            val subscriptionTier = try {
                SubscriptionTier.valueOf(tier.uppercase())
            } catch (e: Exception) {
                return ResponseEntity.badRequest().body(mapOf(
                    "success" to false,
                    "message" to "Invalid subscription tier: $tier"
                ))
            }
            
            val updatedUser = userService.upgradeSubscription(userId, subscriptionTier)
            ResponseEntity.ok(mapOf(
                "success" to true,
                "message" to "Subscription updated to $tier",
                "newTier" to updatedUser.subscriptionTier.name
            ))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf(
                "success" to false,
                "message" to e.message.orEmpty()
            ))
        }
    }
    
    @DeleteMapping("/{userId}")
    fun deleteUser(@PathVariable userId: Long): ResponseEntity<Map<String, Any>> {
        return try {
            userService.deleteUser(userId)
            ResponseEntity.ok(mapOf(
                "success" to true,
                "message" to "Account scheduled for deletion"
            ))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf(
                "success" to false,
                "message" to e.message.orEmpty()
            ))
        }
    }
}