package com.gameiq.service

import com.gameiq.entity.*
import com.gameiq.repository.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import java.time.LocalDateTime
import java.util.*

@Service
@Transactional
class UserService(
    private val userRepository: UserRepository,
    private val quizService: QuizService,
    private val quizSessionRepository: QuizSessionRepository,
    private val quizSessionAttemptRepository: QuizSessionAttemptRepository,
    private val objectMapper: ObjectMapper = jacksonObjectMapper()
) {
    
    // ===== BASIC USER MANAGEMENT METHODS =====
    
    /**
     * Create a new user
     */
    fun createUser(
        email: String, 
        firebaseUid: String, 
        displayName: String? = null,
        primarySport: Sport? = null, 
        primaryPosition: Position? = null,
        age: Int? = null,
        firstName: String? = null,
        lastName: String? = null
    ): User {
        // Check if user already exists (including soft-deleted)
        val existingUser = userRepository.findByFirebaseUid(firebaseUid)
        if (existingUser != null) {
            if (existingUser.deletedAt != null) {
                // Reactivate soft-deleted account with new registration details
                val reactivated = existingUser.copy(
                    deletedAt = null,
                    isActive = true,
                    primarySport = primarySport,
                    primaryPosition = primaryPosition,
                    updatedAt = LocalDateTime.now()
                )
                return userRepository.save(reactivated)
            }
            throw IllegalArgumentException("User already exists with Firebase UID: $firebaseUid")
        }
        
        val newUser = User(
            firebaseUid = firebaseUid,
            email = email,
            displayName = displayName ?: email.substringBefore("@"), // Use email prefix as default display name
            subscriptionTier = SubscriptionTier.TRIAL,
            primarySport = primarySport,
            primaryPosition = primaryPosition,
            age = age,
            firstName = firstName,
            lastName = lastName
        )
        
        return userRepository.save(newUser)
    }
    
    /**
     * Update user profile
     */
    fun updateUserProfile(
        userId: Long,
        displayName: String? = null,
        primarySport: Sport? = null,
        primaryPosition: Position? = null,
        age: Int? = null,
        subscriptionTier: SubscriptionTier? = null,
        email: String? = null,
        fitnessGoals: List<String>? = null
    ): User {
        val user = userRepository.findById(userId).orElseThrow {
            IllegalArgumentException("User not found: $userId")
        }

        val updatedUser = user.copy(
            displayName = displayName ?: user.displayName,
            primarySport = primarySport ?: user.primarySport,
            primaryPosition = primaryPosition ?: user.primaryPosition,
            age = age ?: user.age,
            email = email ?: user.email,
            subscriptionTier = subscriptionTier ?: user.subscriptionTier,
            fitnessGoals = fitnessGoals?.joinToString(",") ?: user.fitnessGoals,
            updatedAt = LocalDateTime.now()
        )

        return userRepository.save(updatedUser)
    }

    /**
     * Update only the user's fitness goals
     */
    fun updateFitnessGoals(userId: Long, fitnessGoals: List<String>): User {
        val user = userRepository.findById(userId).orElseThrow {
            IllegalArgumentException("User not found: $userId")
        }

        val updatedUser = user.copy(
            fitnessGoals = fitnessGoals.joinToString(","),
            updatedAt = LocalDateTime.now()
        )

        return userRepository.save(updatedUser)
    }
    
    /**
     * Find user by ID
     */
    fun findById(userId: Long): User {
        return userRepository.findById(userId).orElseThrow { 
            IllegalArgumentException("User not found: $userId") 
        }
    }
    
    /**
     * Find user by Firebase UID
     */
    fun findByFirebaseUid(firebaseUid: String): User? {
        val user = userRepository.findByFirebaseUid(firebaseUid) ?: return null
        if (user.deletedAt != null) {
            // Reactivate soft-deleted account
            val reactivated = user.copy(
                deletedAt = null,
                isActive = true,
                updatedAt = LocalDateTime.now()
            )
            return userRepository.save(reactivated)
        }
        return user
    }
    
    /**
     * Upgrade user subscription
     */
    fun upgradeSubscription(userId: Long, subscriptionTier: SubscriptionTier): User {
        val user = userRepository.findById(userId).orElseThrow { 
            IllegalArgumentException("User not found: $userId") 
        }
        
        val updatedUser = user.copy(
            subscriptionTier = subscriptionTier,
            updatedAt = LocalDateTime.now()
        )
        
        return userRepository.save(updatedUser)
    }
    
    /**
     * Deactivate user account
     */
    fun deactivateUser(userId: Long): User {
        val user = userRepository.findById(userId).orElseThrow { 
            IllegalArgumentException("User not found: $userId") 
        }
        
        val deactivatedUser = user.copy(
            isActive = false,
            updatedAt = LocalDateTime.now()
        )
        
        return userRepository.save(deactivatedUser)
    }

    fun deleteUser(userId: Long) {
        val user = userRepository.findById(userId).orElseThrow {
            IllegalArgumentException("User not found: $userId")
        }
        val softDeleted = user.copy(
            deletedAt = LocalDateTime.now(),
            updatedAt = LocalDateTime.now()
        )
        userRepository.save(softDeleted)
    }
    
    // ===== NEW QUIZ SYSTEM INTEGRATION =====
    
    /**
     * Create or get core quiz for user
     */
    fun createCoreQuizForUser(userId: Long, sport: String, position: String): QuizSession {
        checkUserExists(userId)
        return quizService.createOrGetCoreQuiz(userId, sport, position)
    }
    
    /**
     * Generate new AI quiz (after passing previous quiz with 70%+)
     */
    fun generateNewQuizForUser(userId: Long, sport: String, position: String): QuizSession {
        checkUserExists(userId)
        checkQuizRateLimit(userId)
        return quizService.generateNewQuiz(userId, sport, position)
    }
    
    /**
     * Start a quiz attempt
     */
    fun startQuizAttempt(userId: Long, quizSessionId: Long): QuizAttemptSession {
        checkUserExists(userId)
        return quizService.startQuizAttempt(userId, quizSessionId)
    }
    
    /**
     * Submit quiz answers and get results
     */
    fun submitQuizAnswers(
        userId: Long,
        quizSessionId: Long, 
        answers: List<QuizAnswer>,
        totalTimeTaken: Int? = null
    ): QuizSessionAttempt {
        checkUserExists(userId)
        return quizService.submitQuizAttempt(userId, quizSessionId, answers, totalTimeTaken)
    }
    
    /**
     * Get user's quiz history with filtering
     */
    fun getUserQuizHistory(
        userId: Long, 
        sport: String? = null, 
        position: String? = null,
        minScore: Int? = null
    ): List<QuizSessionSummary> {
        checkUserExists(userId)
        return quizService.getQuizSessions(userId, sport, position, minScore)
    }
    
    /**
     * Get detailed quiz attempt results
     */
    fun getQuizAttemptDetail(userId: Long, attemptId: Long): QuizAttemptDetail {
        checkUserExists(userId)
        return quizService.getQuizAttemptDetail(userId, attemptId)
    }
    
    /**
     * Check if user can generate new quiz
     */
    fun canGenerateNewQuiz(userId: Long, sport: String, position: String): Boolean {
        checkUserExists(userId)
        return quizService.canGenerateNewQuiz(userId, sport, position)
    }
    
    /**
     * Get user quiz statistics
     */
    fun getUserQuizStats(userId: Long): UserQuizStats {
        val user = userRepository.findById(userId).orElseThrow { 
            IllegalArgumentException("User not found") 
        }
        
        val sessions = quizSessionRepository.findByUserIdOrderByCreatedAtAsc(userId)
        val attempts = quizSessionAttemptRepository.findByUserIdOrderByCompletedAtDesc(userId)
        
        val totalQuizzes = sessions.size
        val totalAttempts = attempts.size
        val averageScore = attempts.map { it.totalScore }.average().takeIf { !it.isNaN() } ?: 0.0
        val bestScore = attempts.maxOfOrNull { it.totalScore } ?: 0
        
        // Calculate current streak (days with quiz activity)
        val recentAttempts = attempts.filter { 
            it.completedAt.isAfter(java.time.Instant.now().minusSeconds(30 * 24 * 60 * 60)) 
        }
        val currentStreak = calculateQuizStreak(recentAttempts)
        
        // Calculate improvement trend
        val improvementTrend = calculateImprovementTrend(attempts)
        
        return UserQuizStats(
            totalQuizzesCreated = totalQuizzes,
            totalAttemptsCompleted = totalAttempts,
            averageScore = averageScore,
            bestScore = bestScore,
            currentStreak = currentStreak,
            improvementTrend = improvementTrend
        )
    }
    
    /**
     * Get user quiz stats by sport
     */
    fun getUserQuizStatsBySport(userId: Long, sport: String, position: String): SportQuizStats {
        val user = userRepository.findById(userId).orElseThrow { 
            IllegalArgumentException("User not found") 
        }
        
        val sessions = quizSessionRepository.findByUserIdAndSportAndPosition(userId, sport, position)
        val attempts = sessions.flatMap { session ->
            quizSessionAttemptRepository.findByQuizSessionIdOrderByAttemptNumberDesc(session.id)
        }
        
        val averageScore = attempts.map { it.totalScore }.average().takeIf { !it.isNaN() } ?: 0.0
        val totalQuizzes = sessions.size.toLong()
        val bestScores = attempts.sortedByDescending { it.totalScore }.take(5)
        
        // Performance by quiz type - build map step by step to avoid type inference issues
        val corePerformance = sessions.filter { it.quizType == QuizType.CORE }
            .flatMap { session -> quizSessionAttemptRepository.findByQuizSessionIdOrderByAttemptNumberDesc(session.id) }
            .map { it.totalScore.toDouble() }
            .average()
            .takeIf { !it.isNaN() } ?: 0.0
            
        val generatedPerformance = sessions.filter { it.quizType == QuizType.GENERATED }
            .flatMap { session -> quizSessionAttemptRepository.findByQuizSessionIdOrderByAttemptNumberDesc(session.id) }
            .map { it.totalScore.toDouble() }
            .average()
            .takeIf { !it.isNaN() } ?: 0.0
        
        val performanceByQuizType = mutableMapOf<QuizType, Double>()
        performanceByQuizType[QuizType.CORE] = corePerformance
        performanceByQuizType[QuizType.GENERATED] = generatedPerformance
        
        return SportQuizStats(
            sport = Sport.valueOf(sport.uppercase()),
            averageScore = averageScore,
            totalQuizzes = totalQuizzes,
            bestScores = emptyList(), // Simplified - remove QuizResult conversion for now
            performanceByQuizType = performanceByQuizType
        )
    }
    
    /**
     * Tag a quiz attempt
     */
    fun tagQuizAttempt(userId: Long, attemptId: Long, tagNames: List<String>): QuizSessionAttempt {
        checkUserExists(userId)
        // Implementation would need to add tagging support to quiz attempts
        // For now, return the attempt unchanged
        return quizSessionAttemptRepository.findById(attemptId)
            .orElseThrow { IllegalArgumentException("Quiz attempt not found") }
    }
    
    /**
     * Share quiz result to social platform
     */
    fun shareQuizResult(userId: Long, attemptId: Long, platform: String): ShareResult {
        val attempt = quizSessionAttemptRepository.findById(attemptId)
            .orElseThrow { IllegalArgumentException("Quiz attempt not found") }
            
        if (attempt.user.id != userId) {
            throw IllegalArgumentException("Quiz attempt does not belong to user")
        }
        
        // Create shareable content
        val shareableContent = generateShareableContent(attempt)
        
        return ShareResult(
            success = true,
            platform = platform,
            content = shareableContent
        )
    }
    
    /**
     * Generate shareable content for a quiz attempt
     */
    fun generateShareableContent(attempt: QuizSessionAttempt): ShareableQuizContent {
        val scoreLevel = when {
            attempt.totalScore >= 90 -> "Expert"
            attempt.totalScore >= 80 -> "Advanced" 
            attempt.totalScore >= 70 -> "Proficient"
            attempt.totalScore >= 60 -> "Developing"
            else -> "Beginner"
        }
        
        val session = attempt.quizSession
        val challengeText = "Can you beat my ${session.sport} ${session.position} quiz score?"
        
        return ShareableQuizContent(
            title = "${attempt.user.displayName}'s ${session.sport} ${session.position} Quiz Result",
            score = "${attempt.totalScore}%",
            scoreLevel = scoreLevel,
            sport = Sport.valueOf(session.sport.uppercase()),
            position = session.position?.let { Position.valueOf(it.uppercase()) },
            challengeText = challengeText,
            quizType = QuizType.valueOf("FORMATION_RECOGNITION") // Default fallback
        )
    }
    
    // ===== HELPER METHODS =====
    
    private fun checkUserExists(userId: Long) {
        if (!userRepository.existsById(userId)) {
            throw IllegalArgumentException("User not found: $userId")
        }
    }
    
    
    private fun checkQuizRateLimit(userId: Long) {
        val user = userRepository.findById(userId).orElseThrow {
            IllegalArgumentException("User not found")
        }

        when (user.subscriptionTier) {
            SubscriptionTier.NONE -> throw IllegalStateException("Active subscription required for quiz generation.")
            else -> { /* TRIAL, BASIC, PREMIUM all get quiz access */ }
        }
    }
    
    private fun calculateQuizStreak(recentAttempts: List<QuizSessionAttempt>): Int {
        if (recentAttempts.isEmpty()) return 0
        
        val attemptDates = recentAttempts
            .map { it.completedAt.atZone(java.time.ZoneId.systemDefault()).toLocalDate() }
            .distinct()
            .sortedDescending()
        
        var streak = 0
        var currentDate = java.time.LocalDate.now()
        
        for (attemptDate in attemptDates) {
            val daysDiff = java.time.Period.between(attemptDate, currentDate).days
            
            if (daysDiff <= 1) {
                streak++
                currentDate = attemptDate
            } else {
                break
            }
        }
        
        return streak
    }
    
    private fun calculateImprovementTrend(attempts: List<QuizSessionAttempt>): Double {
        if (attempts.size < 4) return 0.0
        
        val sortedAttempts = attempts.sortedBy { it.completedAt }
        val firstHalf = sortedAttempts.take(sortedAttempts.size / 2)
        val secondHalf = sortedAttempts.drop(sortedAttempts.size / 2)
        
        val firstHalfAvg = firstHalf.map { it.totalScore }.average()
        val secondHalfAvg = secondHalf.map { it.totalScore }.average()
        
        return secondHalfAvg - firstHalfAvg
    }
}

// Data classes for compatibility with the new quiz system
data class UserQuizStats(
    val totalQuizzesCreated: Int,
    val totalAttemptsCompleted: Int,
    val averageScore: Double,
    val bestScore: Int,
    val currentStreak: Int,
    val improvementTrend: Double
)

data class ShareResult(
    val success: Boolean,
    val platform: String,
    val content: ShareableQuizContent
)