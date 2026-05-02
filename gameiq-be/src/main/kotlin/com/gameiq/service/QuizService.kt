package com.gameiq.service

import com.gameiq.entity.*
import com.gameiq.repository.*
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
@Transactional
class QuizService(
    private val quizSessionRepository: QuizSessionRepository,
    private val quizSessionAttemptRepository: QuizSessionAttemptRepository,
    private val quizSessionQuestionResultRepository: QuizSessionQuestionResultRepository,
    private val quizQuestionRepository: QuizQuestionRepository,
    private val quizCategoryRepository: QuizCategoryRepository,
    private val userRepository: UserRepository,
    private val quizGenerationService: QuizGenerationService
) {
    private val logger = LoggerFactory.getLogger(QuizService::class.java)

    // 1. CREATE OR GET CORE QUIZ (ALL questions from JSON file)
    fun createOrGetCoreQuiz(userId: Long, sport: String, position: String): QuizSession {
        // Check if core quiz already exists for this user/sport/position
        var coreQuiz = quizSessionRepository.findByUserIdAndQuizTypeAndSportAndPosition(
            userId, QuizType.CORE, sport, position
        )
        
        if (coreQuiz == null) {
            // Create core quiz with ALL available questions for this sport/position
            val allQuestions = quizQuestionRepository.findBySportAndPosition(sport, position)
            if (allQuestions.isEmpty()) {
                throw IllegalArgumentException("No questions available for $sport/$position")
            }
            
            val user = userRepository.findById(userId)
                .orElseThrow { IllegalArgumentException("User not found: $userId") }
            
            coreQuiz = QuizSession(
                user = user,
                quizType = QuizType.CORE,
                sport = sport,
                position = position,
                questionIds = allQuestions.map { it.id },
                sessionName = "Core ${sport.capitalize()} ${position.capitalize()} Quiz"
            )
            
            coreQuiz = quizSessionRepository.save(coreQuiz)
            logger.info("Created core quiz for user $userId: $sport/$position with ${allQuestions.size} questions")
        }
        
        return coreQuiz
    }

    // 2. START A QUIZ ATTEMPT (returns the questions in order)
    fun startQuizAttempt(userId: Long, quizSessionId: Long): QuizAttemptSession {
        val quizSession = quizSessionRepository.findById(quizSessionId)
            .orElseThrow { IllegalArgumentException("Quiz session not found: $quizSessionId") }
            
        if (quizSession.user.id != userId) {
            throw IllegalArgumentException("Quiz session does not belong to user")
        }
        
        // Get the questions for this quiz in the same order
        val questions = quizQuestionRepository.findAllById(quizSession.questionIds)
            .sortedBy { quizSession.questionIds.indexOf(it.id) } // Maintain order
            
        val nextAttemptNumber = quizSessionAttemptRepository.getNextAttemptNumber(quizSessionId)
        
        logger.info("Starting attempt #$nextAttemptNumber for quiz session $quizSessionId")
        
        return QuizAttemptSession(
            quizSession = quizSession,
            questions = questions,
            attemptNumber = nextAttemptNumber
        )
    }

    // 3. SUBMIT COMPLETE QUIZ ATTEMPT (all answers at once - variable length for core, 15 for generated)
    fun submitQuizAttempt(
        userId: Long, 
        quizSessionId: Long, 
        answers: List<QuizAnswer>,
        totalTimeTaken: Int? = null
    ): QuizSessionAttempt {
        val quizSession = quizSessionRepository.findById(quizSessionId)
            .orElseThrow { IllegalArgumentException("Quiz session not found: $quizSessionId") }
            
        if (quizSession.user.id != userId) {
            throw IllegalArgumentException("Quiz session does not belong to user")
        }
        
        val expectedQuestionCount = quizSession.questionIds.size
        if (answers.size != expectedQuestionCount) {
            throw IllegalArgumentException("Must provide exactly $expectedQuestionCount answers. Received: ${answers.size}")
        }
        
        val user = userRepository.findById(userId)
            .orElseThrow { IllegalArgumentException("User not found: $userId") }
        
        // Get questions in order
        val questions = quizQuestionRepository.findAllById(quizSession.questionIds)
            .associateBy { it.id }
            
        // Validate all questions are answered
        val questionIds = quizSession.questionIds
        answers.forEachIndexed { index, answer ->
            val expectedQuestionId = questionIds[index]
            if (answer.questionId != expectedQuestionId) {
                throw IllegalArgumentException("Answer at position ${index + 1} is for wrong question. Expected: $expectedQuestionId, Got: ${answer.questionId}")
            }
        }
        
        // Calculate score
        var correctAnswers = 0
        val questionResults = answers.mapIndexed { index, answer ->
            val question = questions[answer.questionId]!!
            val isCorrect = answer.selectedAnswer == question.correct
            if (isCorrect) correctAnswers++
            
            QuizSessionQuestionResult(
                sessionAttempt = QuizSessionAttempt(
                    quizSession = quizSession,
                    user = user,
                    attemptNumber = 0, // Temporary - will be updated when attempt is created
                    totalScore = 0,
                    correctAnswers = 0
                ),
                question = question,
                questionNumber = index + 1,
                answerSelected = answer.selectedAnswer,
                isCorrect = isCorrect,
                timeTaken = answer.timeTaken
            )
        }
        
        val totalScore = (correctAnswers * 100) / expectedQuestionCount // Convert to percentage
        val attemptNumber = quizSessionAttemptRepository.getNextAttemptNumber(quizSessionId)
        
        // Create attempt
        var attempt = QuizSessionAttempt(
            quizSession = quizSession,
            user = user,
            attemptNumber = attemptNumber,
            totalScore = totalScore,
            correctAnswers = correctAnswers,
            timeTaken = totalTimeTaken,
            completedAt = Instant.now()
        )
        
        attempt = quizSessionAttemptRepository.save(attempt)
        
        // Save question results
        val savedQuestionResults = questionResults.map { result ->
            quizSessionQuestionResultRepository.save(result.copy(sessionAttempt = attempt))
        }
        
        logger.info("Quiz attempt completed: user=$userId, session=$quizSessionId, attempt=$attemptNumber, score=$totalScore%, correct=$correctAnswers/$expectedQuestionCount")
        
        return attempt.copy(questionResults = savedQuestionResults)
    }

    // 4. GET QUIZ RESULTS - Summary view
    fun getQuizSessions(
        userId: Long, 
        sport: String? = null, 
        position: String? = null,
        minScore: Int? = null
    ): List<QuizSessionSummary> {
        val sessions = if (sport != null && position != null) {
            quizSessionRepository.findByUserIdAndSportAndPosition(userId, sport, position)
        } else {
            quizSessionRepository.findByUserIdOrderByCreatedAtAsc(userId)
        }
        
        return sessions.map { session ->
            val attempts = quizSessionAttemptRepository.findByQuizSessionIdOrderByAttemptNumberDesc(session.id)
            val filteredAttempts = if (minScore != null) {
                attempts.filter { it.totalScore >= minScore }
            } else {
                attempts
            }
            
            QuizSessionSummary(
                session = session,
                attempts = filteredAttempts,
                totalAttempts = attempts.size,
                bestScore = attempts.maxOfOrNull { it.totalScore } ?: 0,
                latestScore = attempts.firstOrNull()?.totalScore ?: 0,
                passed = (attempts.maxOfOrNull { it.totalScore } ?: 0) >= 70
            )
        }
    }

    // 5. GET DETAILED QUIZ ATTEMPT RESULTS - Individual question breakdown
    fun getQuizAttemptDetail(userId: Long, attemptId: Long): QuizAttemptDetail {
        val attempt = quizSessionAttemptRepository.findById(attemptId)
            .orElseThrow { IllegalArgumentException("Quiz attempt not found: $attemptId") }
            
        if (attempt.user.id != userId) {
            throw IllegalArgumentException("Quiz attempt does not belong to user")
        }
        
        val questionResults = quizSessionQuestionResultRepository
            .findBySessionAttemptIdOrderByQuestionNumber(attemptId)
            
        return QuizAttemptDetail(
            attempt = attempt,
            questionResults = questionResults
        )
    }

    // 6. CHECK IF USER CAN GENERATE NEW QUIZ (must pass previous with 70%+)
    fun canGenerateNewQuiz(userId: Long, sport: String, position: String): Boolean {
        // For core quiz, just check if it exists and is passed
        val coreQuiz = quizSessionRepository.findByUserIdAndQuizTypeAndSportAndPosition(
            userId, QuizType.CORE, sport, position
        )
        
        if (coreQuiz == null || !coreQuiz.passed) {
            return false
        }
        
        // For generated quizzes, check if latest quiz is passed
        val latestQuiz = quizSessionRepository.findLatestQuizSession(userId, sport, position)
        return latestQuiz?.passed == true
    }

    // 7. GENERATE NEW QUIZ (only if user passed previous quiz with 70%+)
    fun generateNewQuiz(userId: Long, sport: String, position: String): QuizSession {
        if (!canGenerateNewQuiz(userId, sport, position)) {
            throw IllegalArgumentException("Cannot generate new quiz. Must pass previous quiz with 70% or higher.")
        }
        
        val user = userRepository.findById(userId)
            .orElseThrow { IllegalArgumentException("User not found: $userId") }
            
        // Get existing quiz count to name the new one
        val existingQuizzes = quizSessionRepository.findByUserIdAndSportAndPosition(userId, sport, position)
        val quizNumber = existingQuizzes.size + 1
        
        // Generate new 15 questions (avoid recent questions if possible)
        val questions = quizGenerationService.getRandomQuestions(sport, position, 15)
        if (questions.size < 15) {
            throw IllegalArgumentException("Not enough questions available for $sport/$position")
        }
        
        val newQuiz = QuizSession(
            user = user,
            quizType = QuizType.GENERATED,
            sport = sport,
            position = position,
            questionIds = questions.map { it.id },
            sessionName = "Generated ${sport.capitalize()} ${position.capitalize()} Quiz #${quizNumber - 1}" // Subtract 1 because core quiz counts
        )
        
        val savedQuiz = quizSessionRepository.save(newQuiz)
        logger.info("Generated new quiz for user $userId: $sport/$position (Quiz #${quizNumber - 1})")
        
        return savedQuiz
    }

    // PRIVATE HELPER METHODS
    private fun String.capitalize(): String {
        return this.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    }
}