package com.gameiq.repository

import com.gameiq.entity.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface WorkoutPlanRepository : JpaRepository<WorkoutPlan, Long> {
    
    // User-based queries
    fun findByUser(user: User): List<WorkoutPlan>
    fun findByUserId(userId: Long): List<WorkoutPlan>
    
    // Sport and Position queries (these exist in our entity)
    fun findBySport(sport: Sport): List<WorkoutPlan>
    fun findByPosition(position: Position): List<WorkoutPlan>
    fun findBySportAndPosition(sport: Sport, position: Position): List<WorkoutPlan>
    
    // User, sport, and position combinations
    fun findByUserAndSportAndPosition(user: User, sport: Sport, position: Position): List<WorkoutPlan>
    
    // Difficulty level queries (using String since our entity uses String)
    fun findByDifficultyLevel(difficultyLevel: String): List<WorkoutPlan>
    fun findBySportAndDifficultyLevel(sport: Sport, difficultyLevel: String): List<WorkoutPlan>
    fun findBySportAndPositionAndDifficultyLevel(
        sport: Sport, 
        position: Position, 
        difficultyLevel: String
    ): List<WorkoutPlan>
    
    // Duration queries (our entity has durationMinutes)
    fun findByDurationMinutesBetween(minDuration: Int, maxDuration: Int): List<WorkoutPlan>
    
    // Saved workouts
    fun findByIsSavedTrue(): List<WorkoutPlan>
    fun findByUserAndIsSavedTrue(user: User): List<WorkoutPlan>
    
    // Date-based queries
    fun findByCreatedAtAfter(createdAt: LocalDateTime): List<WorkoutPlan>
    fun findByUserAndCreatedAtAfter(user: User, createdAt: LocalDateTime): List<WorkoutPlan>
    
    // Custom queries
    @Query("SELECT wp FROM WorkoutPlan wp WHERE wp.user = :user ORDER BY wp.createdAt DESC")
    fun findRecentPlansByUser(@Param("user") user: User): List<WorkoutPlan>
    
    @Query("SELECT COUNT(wp) FROM WorkoutPlan wp WHERE wp.createdAt > :since")
    fun countPlansCreatedSince(@Param("since") since: LocalDateTime): Long
    
    @Query("SELECT wp.sport, COUNT(wp) FROM WorkoutPlan wp GROUP BY wp.sport")
    fun getWorkoutPlanCountBySport(): List<Array<Any>>
}