package com.gameiq.repository

import com.gameiq.entity.ProgressMetrics
import com.gameiq.entity.User
import com.gameiq.entity.Sport
import com.gameiq.entity.Position
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDate
import java.time.LocalDateTime

@Repository
interface ProgressMetricsRepository : JpaRepository<ProgressMetrics, Long> {
    
    // User-specific queries
    fun findByUser(user: User): List<ProgressMetrics>
    fun findByUserId(userId: Long): List<ProgressMetrics>
    
    // Sport and position queries
    fun findBySport(sport: Sport): List<ProgressMetrics>
    fun findByPosition(position: Position): List<ProgressMetrics>
    fun findBySportAndPosition(sport: Sport, position: Position): List<ProgressMetrics>
    fun findByUserAndSport(user: User, sport: Sport): List<ProgressMetrics>
    fun findByUserAndSportAndPosition(user: User, sport: Sport, position: Position): List<ProgressMetrics>
    
    // Date-based queries
    fun findByMetricDate(metricDate: LocalDate): List<ProgressMetrics>
    fun findByMetricDateBetween(start: LocalDate, end: LocalDate): List<ProgressMetrics>
    fun findByUserAndMetricDate(user: User, metricDate: LocalDate): ProgressMetrics?
    fun findByUserAndMetricDateBetween(user: User, start: LocalDate, end: LocalDate): List<ProgressMetrics>
    
    // Latest metrics per user
    @Query("""
        SELECT pm FROM ProgressMetrics pm 
        WHERE pm.user = :user 
        ORDER BY pm.metricDate DESC
    """)
    fun findLatestMetricsByUser(@Param("user") user: User): List<ProgressMetrics>
    
    @Query("""
        SELECT pm FROM ProgressMetrics pm 
        WHERE pm.user = :user 
        AND pm.sport = :sport
        ORDER BY pm.metricDate DESC
    """)
    fun findLatestMetricsBySport(@Param("user") user: User, @Param("sport") sport: Sport): List<ProgressMetrics>
    
    // Streak tracking
    @Query("""
        SELECT MAX(pm.currentIqStreakDays) FROM ProgressMetrics pm 
        WHERE pm.user = :user
    """)
    fun getMaxIqStreakByUser(@Param("user") user: User): Int?
    
    @Query("""
        SELECT MAX(pm.currentTrainingStreakDays) FROM ProgressMetrics pm 
        WHERE pm.user = :user
    """)
    fun getMaxTrainingStreakByUser(@Param("user") user: User): Int?
    
    @Query("""
        SELECT pm FROM ProgressMetrics pm 
        WHERE pm.user = :user 
        AND pm.currentIqStreakDays > 0
        ORDER BY pm.metricDate DESC
    """)
    fun findActiveIqStreaksByUser(@Param("user") user: User): List<ProgressMetrics>
    
    // Performance tracking
    @Query("""
        SELECT AVG(pm.avgQuizScorePercentage) FROM ProgressMetrics pm 
        WHERE pm.user = :user 
        AND pm.avgQuizScorePercentage IS NOT NULL
    """)
    fun getOverallAverageQuizScore(@Param("user") user: User): Double?
    
    @Query("""
        SELECT SUM(pm.workoutsCompletedCount) FROM ProgressMetrics pm 
        WHERE pm.user = :user
    """)
    fun getTotalWorkoutsCompleted(@Param("user") user: User): Long?
    
    @Query("""
        SELECT SUM(pm.totalTrainingMinutes) FROM ProgressMetrics pm 
        WHERE pm.user = :user
    """)
    fun getTotalTrainingMinutes(@Param("user") user: User): Long?
    
    // Recent progress
    @Query("""
        SELECT pm FROM ProgressMetrics pm 
        WHERE pm.user = :user 
        AND pm.metricDate >= :since
        ORDER BY pm.metricDate DESC
    """)
    fun findRecentProgressByUser(@Param("user") user: User, @Param("since") since: LocalDate): List<ProgressMetrics>
    
    // Weekly/Monthly aggregates
    @Query("""
        SELECT SUM(pm.workoutsCompletedCount), SUM(pm.totalTrainingMinutes) 
        FROM ProgressMetrics pm 
        WHERE pm.user = :user 
        AND pm.metricDate >= :start 
        AND pm.metricDate <= :end
    """)
    fun getTrainingStatsBetween(
        @Param("user") user: User, 
        @Param("start") start: LocalDate, 
        @Param("end") end: LocalDate
    ): Array<Long?>?
    
    @Query("""
        SELECT AVG(pm.avgQuizScorePercentage), SUM(pm.quizzesCompletedCount) 
        FROM ProgressMetrics pm 
        WHERE pm.user = :user 
        AND pm.metricDate >= :start 
        AND pm.metricDate <= :end
        AND pm.avgQuizScorePercentage IS NOT NULL
    """)
    fun getQuizStatsBetween(
        @Param("user") user: User, 
        @Param("start") start: LocalDate, 
        @Param("end") end: LocalDate
    ): Array<Double?>?
    
    // Improvement tracking
    @Query("""
        SELECT pm FROM ProgressMetrics pm 
        WHERE pm.user = :user 
        AND pm.improvementScore IS NOT NULL
        ORDER BY pm.metricDate DESC
    """)
    fun findImprovementTrendsByUser(@Param("user") user: User): List<ProgressMetrics>
    
    @Query("""
        SELECT MAX(pm.positionMasteryPercentage) FROM ProgressMetrics pm 
        WHERE pm.user = :user 
        AND pm.sport = :sport 
        AND pm.position = :position
    """)
    fun getMaxMasteryPercentage(
        @Param("user") user: User, 
        @Param("sport") sport: Sport, 
        @Param("position") position: Position
    ): Double?
    
    // Leaderboard data
    @Query("""
        SELECT pm.user, MAX(pm.currentIqStreakDays) as maxStreak 
        FROM ProgressMetrics pm 
        WHERE pm.sport = :sport 
        GROUP BY pm.user 
        ORDER BY maxStreak DESC
    """)
    fun getIqStreakLeaderboardBySport(@Param("sport") sport: Sport): List<Array<Any>>
    
    @Query("""
        SELECT pm.user, MAX(pm.currentTrainingStreakDays) as maxStreak 
        FROM ProgressMetrics pm 
        WHERE pm.sport = :sport 
        GROUP BY pm.user 
        ORDER BY maxStreak DESC
    """)
    fun getTrainingStreakLeaderboardBySport(@Param("sport") sport: Sport): List<Array<Any>>
    
    // Activity patterns
    @Query("""
        SELECT AVG(pm.daysActiveThisWeek) FROM ProgressMetrics pm 
        WHERE pm.user = :user 
        AND pm.metricDate >= :since
    """)
    fun getAverageActiveDays(@Param("user") user: User, @Param("since") since: LocalDate): Double?
    
    // Badge and achievement tracking
    @Query("""
        SELECT pm FROM ProgressMetrics pm 
        WHERE pm.user = :user 
        AND pm.achievementBadgesEarned IS NOT NULL
        ORDER BY pm.metricDate DESC
    """)
    fun findBadgeProgressByUser(@Param("user") user: User): List<ProgressMetrics>
    
    // Most recent metric for each user (for dashboard)
    @Query("""
        SELECT pm FROM ProgressMetrics pm 
        WHERE pm.metricDate = (
            SELECT MAX(pm2.metricDate) 
            FROM ProgressMetrics pm2 
            WHERE pm2.user = pm.user
        )
    """)
    fun findLatestMetricsForAllUsers(): List<ProgressMetrics>
}