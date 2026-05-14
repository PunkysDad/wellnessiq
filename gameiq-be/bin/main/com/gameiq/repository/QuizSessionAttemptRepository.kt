package com.gameiq.repository

import com.gameiq.entity.QuizSessionAttempt
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.Instant

@Repository
interface QuizSessionAttemptRepository : JpaRepository<QuizSessionAttempt, Long> {
    
    // Find attempts for a session
    fun findByQuizSessionIdOrderByAttemptNumberAsc(quizSessionId: Long): List<QuizSessionAttempt>
    fun findByQuizSessionIdOrderByAttemptNumberDesc(quizSessionId: Long): List<QuizSessionAttempt>
    
    // Find user's attempts
    fun findByUserIdOrderByCompletedAtDesc(userId: Long): List<QuizSessionAttempt>
    
    // Find attempts by score threshold
    @Query("""
        SELECT qsa FROM QuizSessionAttempt qsa 
        WHERE qsa.user.id = :userId 
        AND qsa.totalScore >= :minScore 
        ORDER BY qsa.completedAt DESC
    """)
    fun findByUserIdAndScoreGreaterThanEqual(@Param("userId") userId: Long, @Param("minScore") minScore: Int): List<QuizSessionAttempt>
    
    // Find attempts in date range
    fun findByUserIdAndCompletedAtBetweenOrderByCompletedAtDesc(
        userId: Long, 
        start: Instant, 
        end: Instant
    ): List<QuizSessionAttempt>
    
    // Get user's best attempt for a specific session
    @Query("""
        SELECT qsa FROM QuizSessionAttempt qsa 
        WHERE qsa.quizSession.id = :sessionId 
        ORDER BY qsa.totalScore DESC, qsa.completedAt DESC 
        LIMIT 1
    """)
    fun findBestAttemptForSession(@Param("sessionId") sessionId: Long): QuizSessionAttempt?
    
    // Get next attempt number for a session
    @Query("SELECT COALESCE(MAX(qsa.attemptNumber), 0) + 1 FROM QuizSessionAttempt qsa WHERE qsa.quizSession.id = :sessionId")
    fun getNextAttemptNumber(@Param("sessionId") sessionId: Long): Int
}