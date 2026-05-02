package com.gameiq.controller

import com.gameiq.entity.*
import com.gameiq.service.*
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

@RestController
@RequestMapping("/quiz")
class QuizController(
    private val quizService: QuizService
) {

    // 1. CREATE OR GET A QUIZ (15 questions for sport/position)
    @PostMapping("/create")
    fun createOrGetCoreQuiz(
        @RequestBody request: CreateQuizRequest
    ): ResponseEntity<QuizSession> {
        val quiz = quizService.createOrGetCoreQuiz(
            userId = request.userId,
            sport = request.sport,
            position = request.position
        )
        return ResponseEntity.ok(quiz)
    }

    // 2. START A QUIZ ATTEMPT (get the 15 questions)
    @PostMapping("/start")
    fun startQuizAttempt(
        @RequestBody request: StartQuizRequest
    ): ResponseEntity<QuizAttemptSession> {
        val attemptSession = quizService.startQuizAttempt(
            userId = request.userId,
            quizSessionId = request.quizSessionId
        )
        return ResponseEntity.ok(attemptSession)
    }

    // 3. SUBMIT COMPLETE QUIZ ATTEMPT (all 15 answers)
    @PostMapping("/submit")
    fun submitQuizAttempt(
        @RequestBody request: SubmitQuizRequest
    ): ResponseEntity<QuizSessionAttempt> {
        val result = quizService.submitQuizAttempt(
            userId = request.userId,
            quizSessionId = request.quizSessionId,
            answers = request.answers,
            totalTimeTaken = request.totalTimeTaken
        )
        return ResponseEntity.ok(result)
    }

    // 4. GET QUIZ RESULTS - Summary view with filtering
    @GetMapping("/results/{userId}")
    fun getQuizResults(
        @PathVariable userId: Long,
        @RequestParam(required = false) sport: String?,
        @RequestParam(required = false) position: String?,
        @RequestParam(required = false) minScore: Int?,
        @RequestParam(required = false) fromDate: String?, // ISO date string
        @RequestParam(required = false) toDate: String?    // ISO date string
    ): ResponseEntity<List<QuizSessionSummary>> {
        var results = quizService.getQuizSessions(userId, sport, position, minScore)
        
        // Filter by date range if provided
        if (fromDate != null || toDate != null) {
            val fromInstant = fromDate?.let { 
                LocalDate.parse(it).atStartOfDay(ZoneId.systemDefault()).toInstant() 
            }
            val toInstant = toDate?.let { 
                LocalDate.parse(it).plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant() 
            }
            
            results = results.filter { summary ->
                val attempts = summary.attempts.filter { attempt ->
                    val completedAt = attempt.completedAt
                    (fromInstant == null || completedAt.isAfter(fromInstant) || completedAt == fromInstant) &&
                    (toInstant == null || completedAt.isBefore(toInstant))
                }
                attempts.isNotEmpty()
            }.map { summary ->
                summary.copy(attempts = summary.attempts.filter { attempt ->
                    val completedAt = attempt.completedAt
                    (fromInstant == null || completedAt.isAfter(fromInstant) || completedAt == fromInstant) &&
                    (toInstant == null || completedAt.isBefore(toInstant))
                })
            }
        }
        
        return ResponseEntity.ok(results)
    }

    // 5. GET DETAILED QUIZ ATTEMPT (individual questions and answers)
    @GetMapping("/attempt/{attemptId}/detail")
    fun getQuizAttemptDetail(
        @PathVariable attemptId: Long,
        @RequestParam userId: Long
    ): ResponseEntity<QuizAttemptDetail> {
        val detail = quizService.getQuizAttemptDetail(userId, attemptId)
        return ResponseEntity.ok(detail)
    }

    // 6. CHECK IF USER CAN GENERATE NEW QUIZ
    @GetMapping("/can-generate")
    fun canGenerateNewQuiz(
        @RequestParam userId: Long,
        @RequestParam sport: String,
        @RequestParam position: String
    ): ResponseEntity<CanGenerateResponse> {
        val canGenerate = quizService.canGenerateNewQuiz(userId, sport, position)
        return ResponseEntity.ok(CanGenerateResponse(canGenerate))
    }

    // 7. GENERATE NEW QUIZ (only after passing previous with 70%+)
    @PostMapping("/generate")
    fun generateNewQuiz(
        @RequestBody request: GenerateNewQuizRequest
    ): ResponseEntity<QuizSession> {
        val newQuiz = quizService.generateNewQuiz(
            userId = request.userId,
            sport = request.sport,
            position = request.position
        )
        return ResponseEntity.ok(newQuiz)
    }

    // GET USER'S ALL QUIZ SESSIONS (overview)
    @GetMapping("/sessions/{userId}")
    fun getUserQuizSessions(
        @PathVariable userId: Long
    ): ResponseEntity<List<QuizSessionSummary>> {
        val sessions = quizService.getQuizSessions(userId)
        return ResponseEntity.ok(sessions)
    }

    @ExceptionHandler(IllegalArgumentException::class)
    fun handleIllegalArgument(e: IllegalArgumentException): ResponseEntity<ErrorResponse> {
        return ResponseEntity.badRequest().body(ErrorResponse(e.message ?: "Invalid request"))
    }

    @ExceptionHandler(Exception::class)
    fun handleGeneralException(e: Exception): ResponseEntity<ErrorResponse> {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ErrorResponse("An error occurred: ${e.message}"))
    }
}

// Request/Response DTOs
data class CreateQuizRequest(
    val userId: Long,
    val sport: String,
    val position: String
)

data class StartQuizRequest(
    val userId: Long,
    val quizSessionId: Long
)

data class SubmitQuizRequest(
    val userId: Long,
    val quizSessionId: Long,
    val answers: List<QuizAnswer>, // List of 15 answers
    val totalTimeTaken: Int? = null // Total time for entire quiz
)

data class GenerateNewQuizRequest(
    val userId: Long,
    val sport: String,
    val position: String
)

data class CanGenerateResponse(
    val canGenerate: Boolean
)

data class ErrorResponse(
    val message: String
)

// Request/Response DTOs
data class GenerateQuizRequest(
    val userId: Long,
    val sport: String,
    val position: String,
    val categoryName: String? = null,
    val difficulty: QuizDifficulty? = null,
    val questionCount: Int? = 5
)

data class SubmitAnswerRequest(
    val userId: Long,
    val questionId: Long,
    val answerSelected: String,
    val timeTaken: Int? = null
)

data class TagQuizResultRequest(
    val userId: Long,
    val quizResultId: Long,
    val tagNames: List<String>
)

// data class ShareQuizResultRequest(
//     val userId: Long,
//     val quizResultId: Long,
//     val platform: SocialPlatform,
//     val shareData: Map<String, Any>? = null
// )