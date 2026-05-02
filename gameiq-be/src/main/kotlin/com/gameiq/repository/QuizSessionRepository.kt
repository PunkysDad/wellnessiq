package com.gameiq.repository

import com.gameiq.entity.QuizSession
import com.gameiq.entity.QuizType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface QuizSessionRepository : JpaRepository<QuizSession, Long> {
    
    // Find user's quiz sessions
    fun findByUserIdOrderByCreatedAtAsc(userId: Long): List<QuizSession>
    fun findByUserIdAndSportAndPosition(userId: Long, sport: String, position: String): List<QuizSession>
    fun findByUserIdAndQuizType(userId: Long, quizType: QuizType): List<QuizSession>
    
    // Find core quiz for sport/position
    fun findByUserIdAndQuizTypeAndSportAndPosition(
        userId: Long, 
        quizType: QuizType, 
        sport: String, 
        position: String
    ): QuizSession?
    
    // Check if user has passed core quiz
    @Query("""
        SELECT COUNT(qs) > 0 FROM QuizSession qs 
        WHERE qs.user.id = :userId 
        AND qs.sport = :sport 
        AND qs.position = :position 
        AND qs.quizType = 'CORE' 
        AND qs.passed = true
    """)
    fun hasPassedCoreQuiz(@Param("userId") userId: Long, @Param("sport") sport: String, @Param("position") position: String): Boolean
    
    // Get user's latest quiz session that needs to be passed for progression
    @Query("""
        SELECT qs FROM QuizSession qs 
        WHERE qs.user.id = :userId 
        AND qs.sport = :sport 
        AND qs.position = :position 
        ORDER BY qs.createdAt DESC 
        LIMIT 1
    """)
    fun findLatestQuizSession(@Param("userId") userId: Long, @Param("sport") sport: String, @Param("position") position: String): QuizSession?
    
    // Check if user can generate new quiz (has passed previous quiz with 70%+)
    @Query("""
        SELECT CASE WHEN COUNT(qs) = 0 THEN false
                   WHEN MAX(qs.bestScore) >= 70 THEN true
                   ELSE false END
        FROM QuizSession qs 
        WHERE qs.user.id = :userId 
        AND qs.sport = :sport 
        AND qs.position = :position
    """)
    fun canGenerateNewQuiz(@Param("userId") userId: Long, @Param("sport") sport: String, @Param("position") position: String): Boolean
}