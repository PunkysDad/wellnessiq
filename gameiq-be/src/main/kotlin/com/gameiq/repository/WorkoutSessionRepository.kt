package com.gameiq.repository

import com.gameiq.entity.WorkoutSession
import com.gameiq.entity.User
import com.gameiq.entity.WorkoutPlan
import com.gameiq.entity.WorkoutStatus
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface WorkoutSessionRepository : JpaRepository<WorkoutSession, Long> {
    
    // User-specific queries
    fun findByUser(user: User): List<WorkoutSession>
    fun findByUserId(userId: Long): List<WorkoutSession>
    
    // Workout plan queries
    fun findByWorkoutPlan(workoutPlan: WorkoutPlan): List<WorkoutSession>
    fun findByWorkoutPlanId(workoutPlanId: Long): List<WorkoutSession>
    
    // Status-based queries
    fun findByStatus(status: WorkoutStatus): List<WorkoutSession>
    fun findByUserAndStatus(user: User, status: WorkoutStatus): List<WorkoutSession>
    
    // Completed workouts
    fun findByStatusAndCompletedAtAfter(status: WorkoutStatus, completedAt: LocalDateTime): List<WorkoutSession>
    fun findByUserAndStatusAndCompletedAtAfter(user: User, status: WorkoutStatus, completedAt: LocalDateTime): List<WorkoutSession>
    
    // Current active sessions
    fun findByUserAndStatusIn(user: User, statuses: List<WorkoutStatus>): List<WorkoutSession>
    
    // Date-based queries
    fun findByStartedAtBetween(start: LocalDateTime, end: LocalDateTime): List<WorkoutSession>
    fun findByCompletedAtBetween(start: LocalDateTime, end: LocalDateTime): List<WorkoutSession>
    fun findByUserAndCompletedAtBetween(user: User, start: LocalDateTime, end: LocalDateTime): List<WorkoutSession>
    
    // User's recent sessions
    @Query("""
        SELECT ws FROM WorkoutSession ws 
        WHERE ws.user = :user 
        ORDER BY ws.createdAt DESC
    """)
    fun findRecentSessionsByUser(@Param("user") user: User): List<WorkoutSession>
    
    // User's completed sessions in date range
    @Query("""
        SELECT ws FROM WorkoutSession ws 
        WHERE ws.user = :user 
        AND ws.status = 'COMPLETED'
        AND ws.completedAt >= :start 
        AND ws.completedAt < :end
        ORDER BY ws.completedAt DESC
    """)
    fun findUserCompletedSessionsBetween(
        @Param("user") user: User, 
        @Param("start") start: LocalDateTime, 
        @Param("end") end: LocalDateTime
    ): List<WorkoutSession>
    
    // User workout streaks
    @Query("""
        SELECT ws FROM WorkoutSession ws 
        WHERE ws.user = :user 
        AND ws.status = 'COMPLETED'
        AND ws.completedAt >= :since
        ORDER BY ws.completedAt DESC
    """)
    fun findUserCompletedSessionsSince(@Param("user") user: User, @Param("since") since: LocalDateTime): List<WorkoutSession>
    
    // Duration-based analytics
    @Query("""
        SELECT AVG(ws.durationMinutes) FROM WorkoutSession ws 
        WHERE ws.user = :user 
        AND ws.status = 'COMPLETED'
        AND ws.durationMinutes IS NOT NULL
    """)
    fun getAverageWorkoutDurationByUser(@Param("user") user: User): Double?
    
    // Rating analytics
    @Query("""
        SELECT AVG(ws.difficultyRating) FROM WorkoutSession ws 
        WHERE ws.user = :user 
        AND ws.difficultyRating IS NOT NULL
    """)
    fun getAverageDifficultyRatingByUser(@Param("user") user: User): Double?
    
    @Query("""
        SELECT AVG(ws.effectivenessRating) FROM WorkoutSession ws 
        WHERE ws.user = :user 
        AND ws.effectivenessRating IS NOT NULL
    """)
    fun getAverageEffectivenessRatingByUser(@Param("user") user: User): Double?
    
    // Completion stats
    @Query("SELECT COUNT(ws) FROM WorkoutSession ws WHERE ws.user = :user AND ws.status = 'COMPLETED'")
    fun countCompletedSessionsByUser(@Param("user") user: User): Long
    
    @Query("SELECT COUNT(ws) FROM WorkoutSession ws WHERE ws.user = :user AND ws.status = 'COMPLETED' AND ws.completedAt >= :since")
    fun countCompletedSessionsByUserSince(@Param("user") user: User, @Param("since") since: LocalDateTime): Long
    
    // Total training time
    @Query("""
        SELECT SUM(ws.durationMinutes) FROM WorkoutSession ws 
        WHERE ws.user = :user 
        AND ws.status = 'COMPLETED' 
        AND ws.durationMinutes IS NOT NULL
    """)
    fun getTotalTrainingMinutesByUser(@Param("user") user: User): Long?
    
    // Most popular workout plans
    @Query("""
        SELECT wp, COUNT(ws) as sessionCount FROM WorkoutSession ws 
        JOIN ws.workoutPlan wp 
        WHERE ws.status = 'COMPLETED'
        GROUP BY wp.id 
        ORDER BY sessionCount DESC
    """)
    fun findMostCompletedWorkoutPlans(): List<Array<Any>>
}