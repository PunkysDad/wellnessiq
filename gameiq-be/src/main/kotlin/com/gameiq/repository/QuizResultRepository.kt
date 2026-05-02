package com.gameiq.repository

import com.gameiq.entity.QuizResult
import com.gameiq.entity.User
import com.gameiq.entity.Sport
import com.gameiq.entity.Position
import com.gameiq.entity.QuizType
import com.gameiq.entity.DifficultyLevel
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface QuizResultRepository : JpaRepository<QuizResult, Long> {
    
    // User-specific queries
    fun findByUser(user: User): List<QuizResult>
    fun findByUserId(userId: Long): List<QuizResult>
    
    // Sport and position queries
    fun findBySport(sport: Sport): List<QuizResult>
    fun findByPosition(position: Position): List<QuizResult>
    fun findBySportAndPosition(sport: Sport, position: Position): List<QuizResult>
    fun findByUserAndSport(user: User, sport: Sport): List<QuizResult>
    fun findByUserAndSportAndPosition(user: User, sport: Sport, position: Position): List<QuizResult>
    
    // Quiz type queries
    fun findByQuizType(quizType: QuizType): List<QuizResult>
    fun findByUserAndQuizType(user: User, quizType: QuizType): List<QuizResult>
    fun findBySportAndQuizType(sport: Sport, quizType: QuizType): List<QuizResult>
    
    // Difficulty level queries
    fun findByDifficultyLevel(difficultyLevel: DifficultyLevel): List<QuizResult>
    fun findByUserAndDifficultyLevel(user: User, difficultyLevel: DifficultyLevel): List<QuizResult>
    
    // Score-based queries
    fun findByScorePercentageGreaterThanEqual(scorePercentage: Double): List<QuizResult>
    fun findByUserAndScorePercentageGreaterThanEqual(user: User, scorePercentage: Double): List<QuizResult>
    
    // Recent quizzes
    fun findByCompletedAtAfter(completedAt: LocalDateTime): List<QuizResult>
    fun findByUserAndCompletedAtAfter(user: User, completedAt: LocalDateTime): List<QuizResult>
    fun findByUserAndCompletedAtBetween(user: User, start: LocalDateTime, end: LocalDateTime): List<QuizResult>
    
    // User's recent quiz results
    @Query("""
        SELECT qr FROM QuizResult qr 
        WHERE qr.user = :user 
        ORDER BY qr.completedAt DESC
    """)
    fun findRecentResultsByUser(@Param("user") user: User): List<QuizResult>
    
    // User's best scores
    @Query("""
        SELECT qr FROM QuizResult qr 
        WHERE qr.user = :user 
        AND qr.sport = :sport
        ORDER BY qr.scorePercentage DESC
    """)
    fun findBestScoresBySport(@Param("user") user: User, @Param("sport") sport: Sport): List<QuizResult>
    
    // Average score calculations
    @Query("""
        SELECT AVG(qr.scorePercentage) FROM QuizResult qr 
        WHERE qr.user = :user
    """)
    fun getAverageScoreByUser(@Param("user") user: User): Double?
    
    @Query("""
        SELECT AVG(qr.scorePercentage) FROM QuizResult qr 
        WHERE qr.user = :user 
        AND qr.sport = :sport
    """)
    fun getAverageScoreBySport(@Param("user") user: User, @Param("sport") sport: Sport): Double?
    
    @Query("""
        SELECT AVG(qr.scorePercentage) FROM QuizResult qr 
        WHERE qr.user = :user 
        AND qr.quizType = :quizType
    """)
    fun getAverageScoreByQuizType(@Param("user") user: User, @Param("quizType") quizType: QuizType): Double?
    
    // Improvement tracking
    @Query("""
        SELECT qr FROM QuizResult qr 
        WHERE qr.user = :user 
        AND qr.sport = :sport 
        AND qr.quizType = :quizType
        ORDER BY qr.completedAt DESC
    """)
    fun findProgressByQuizType(
        @Param("user") user: User, 
        @Param("sport") sport: Sport, 
        @Param("quizType") quizType: QuizType
    ): List<QuizResult>
    
    // Social sharing analytics
    fun findBySharedToFacebookTrue(): List<QuizResult>
    fun findBySharedToTiktokTrue(): List<QuizResult>
    fun findByUserAndSharedToFacebookTrue(user: User): List<QuizResult>
    fun findByUserAndSharedToTiktokTrue(user: User): List<QuizResult>
    
    // Count queries for analytics
    @Query("SELECT COUNT(qr) FROM QuizResult qr WHERE qr.user = :user")
    fun countQuizzesByUser(@Param("user") user: User): Long
    
    @Query("SELECT COUNT(qr) FROM QuizResult qr WHERE qr.user = :user AND qr.completedAt >= :since")
    fun countQuizzesByUserSince(@Param("user") user: User, @Param("since") since: LocalDateTime): Long
    
    @Query("SELECT COUNT(qr) FROM QuizResult qr WHERE qr.user = :user AND qr.scorePercentage >= :minScore")
    fun countQuizzesAboveScore(@Param("user") user: User, @Param("minScore") minScore: Double): Long
    
    // Leaderboard queries
    @Query("""
        SELECT qr.user, AVG(qr.scorePercentage) as avgScore FROM QuizResult qr 
        WHERE qr.sport = :sport 
        AND qr.completedAt >= :since
        GROUP BY qr.user 
        ORDER BY avgScore DESC
    """)
    fun getLeaderboardBySport(@Param("sport") sport: Sport, @Param("since") since: LocalDateTime): List<Array<Any>>
    
    // Time-based performance
    @Query("""
        SELECT AVG(qr.timeTakenSeconds) FROM QuizResult qr 
        WHERE qr.user = :user 
        AND qr.timeTakenSeconds IS NOT NULL
    """)
    fun getAverageTimeByUser(@Param("user") user: User): Double?
    
    // Quiz completion streaks
    @Query("""
        SELECT qr FROM QuizResult qr 
        WHERE qr.user = :user 
        AND qr.completedAt >= :since
        ORDER BY qr.completedAt DESC
    """)
    fun findUserQuizzesSince(@Param("user") user: User, @Param("since") since: LocalDateTime): List<QuizResult>
}