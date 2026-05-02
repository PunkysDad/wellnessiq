package com.gameiq.service

import com.gameiq.entity.*

// Data classes for Claude API responses
data class ClaudeApiResponse(
    val content: String,
    val tokensUsed: TokenUsage
)

data class TokenUsage(
    val input: Int,
    val output: Int
)

// Data classes for service responses
data class WorkoutContent(
    val exercisesJson: String,
    val equipmentNeeded: String?,
    val focusAreas: String?,
    val estimatedDuration: Int?,
    val promptUsed: String?
)

data class QuizContent(
    val questionsJson: String
)

data class WorkoutStats(
    val totalWorkoutsCompleted: Long,
    val totalTrainingMinutes: Long,
    val averageWorkoutDuration: Double?,
    val averageDifficultyRating: Double?,
    val averageEffectivenessRating: Double?,
    val currentStreak: Int
)

data class GeneratedQuiz(
    val sport: Sport,
    val position: Position?,
    val quizType: QuizType,
    val difficultyLevel: DifficultyLevel,
    val questions: List<QuizQuestionData>,
    val title: String
)

data class QuizQuestionData(
    val question: String,
    val options: List<String>,
    val correctAnswer: Int,
    val explanation: String
)

data class QuizStats(
    val totalQuizzesCompleted: Long,
    val averageScore: Double,
    val bestScore: Double,
    val averageTimeSeconds: Double?,
    val currentStreak: Int,
    val improvementTrend: Double
)

data class SportQuizStats(
    val sport: Sport,
    val averageScore: Double,
    val totalQuizzes: Long,
    val bestScores: List<QuizResult>,
    val performanceByQuizType: Map<QuizType, Double>
)

data class ShareableQuizContent(
    val title: String,
    val score: String,
    val scoreLevel: String,
    val sport: Sport,
    val position: Position?,
    val challengeText: String,
    val quizType: QuizType
)

data class LeaderboardEntry(
    val rank: Int,
    val user: User,
    val score: Double,
    val sport: Sport
)

// Quiz system request/response DTOs
data class QuizAnswer(
    val questionId: Long,
    val selectedAnswer: String,
    val timeTaken: Int? = null
)

data class SubmitQuizRequest(
    val answers: List<QuizAnswer>,
    val totalTimeTaken: Int? = null
)

data class QuizSessionSummary(
    val session: QuizSession,
    val attempts: List<QuizSessionAttempt>,
    val totalAttempts: Int,
    val bestScore: Int,
    val latestScore: Int,
    val passed: Boolean
)

data class QuizQuestionResponse(
    val id: Long,
    val questionNumber: Int, // 1-15 position in quiz
    val scenario: String,
    val question: String,
    val options: Map<String, String>, // e.g., {"A": "Option A text", "B": "Option B text"}
    val difficulty: String,
    val tags: List<String>
)

data class QuizSessionResponse(
    val sessionId: Long,
    val sessionName: String,
    val sport: String,
    val position: String,
    val quizType: String,
    val questions: List<QuizQuestionResponse>,
    val totalQuestions: Int,
    val isCompleted: Boolean,
    val bestScore: Int,
    val totalAttempts: Int,
    val passed: Boolean
)

data class QuizAttemptDetail(
    val attempt: QuizSessionAttempt,
    val questionResults: List<QuizSessionQuestionResult>
)

data class QuizAttemptSession(
    val quizSession: QuizSession,
    val questions: List<com.gameiq.entity.QuizQuestion>,
    val attemptNumber: Int
)

// Workout system request/response DTOs
data class WorkoutGenerationRequest(
    val userId: Long,
    val sport: String,
    val position: String? = null,
    val experienceLevel: String, // "beginner", "intermediate", "advanced"
    val trainingPhase: String,   // "off-season", "pre-season", "in-season", "post-season"
    val availableEquipment: List<String>,
    val sessionDuration: Int,    // minutes
    val focusAreas: List<String>,
    val specialRequirements: String? = null,
    val additionalEquipment: String? = null,
    val specialFocusAreas: String? = null,
    val fitnessGoals: List<String>? = null
)

data class WorkoutGenerationResponse(
    val success: Boolean,
    val data: WorkoutPlanDTO? = null,
    val error: String? = null,
    val cost: Double? = null // API cost in dollars
)

data class WorkoutPlanDTO(
    val id: String,
    val title: String,
    val description: String,
    val estimatedDuration: Int,
    val exercises: List<ExerciseDTO>,
    val focusAreas: List<String>,
    val createdAt: String,
    val sport: String? = null,
    val position: String? = null,
    val generatedContent: String? = null,
    val displayTitle: String? = null
)

data class ExerciseDTO(
    val name: String,
    val description: String,
    val sets: Int,
    val reps: String,
    val duration: String? = null,
    val restPeriod: String? = null,
    val instructions: List<String>? = null,
    val videoUrl: String? = null,
    val positionBenefit: String? = null,
    val gameApplication: String? = null,
    val injuryPrevention: String? = null,
    val coachingCue: String? = null
)

data class TagWorkoutRequest(
    val tagIds: List<Long>
)

data class YoutubeVideoResult(
    val videoId: String,
    val title: String,
    val thumbnail: String,
    val channelName: String
)

data class WorkoutSearchFilters(
    val tags: List<String>? = null,
    val sport: String? = null,
    val position: String? = null,
    val dateFrom: String? = null,
    val dateTo: String? = null
)