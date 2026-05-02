package com.gameiq.service

import com.gameiq.entity.*
import com.gameiq.repository.WorkoutPlanRepository
import com.gameiq.repository.UserRepository
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
@Transactional
class WorkoutService(
    private val workoutPlanRepository: WorkoutPlanRepository,
    private val userRepository: UserRepository
    // Remove claudeService dependency - no longer needed
) {

    private val objectMapper: ObjectMapper = jacksonObjectMapper()
    
    // Get all workout plans for user
    fun getUserWorkoutPlans(userId: Long): List<WorkoutPlan> {
        return workoutPlanRepository.findByUserId(userId)
    }
    
    // Get specific workout plan by ID
    fun getWorkoutPlanById(planId: Long): WorkoutPlan? {
        return workoutPlanRepository.findById(planId).orElse(null)
    }
    
    // Save/bookmark a workout (mark as saved)
    fun saveWorkout(workoutId: Long, userId: Long): WorkoutPlan? {
        val workout = workoutPlanRepository.findById(workoutId).orElse(null)
        
        return if (workout != null && workout.user.id == userId) {
            val savedWorkout = workout.copy(
                isSaved = true,
                updatedAt = LocalDateTime.now()
            )
            workoutPlanRepository.save(savedWorkout)
        } else {
            null
        }
    }
    
    // Remove workout from saved/bookmarked (mark as not saved)
    fun unsaveWorkout(workoutId: Long, userId: Long): WorkoutPlan? {
        val workout = workoutPlanRepository.findById(workoutId).orElse(null)
        
        return if (workout != null && workout.user.id == userId) {
            val unsavedWorkout = workout.copy(
                isSaved = false,
                updatedAt = LocalDateTime.now()
            )
            workoutPlanRepository.save(unsavedWorkout)
        } else {
            null
        }
    }
    
    // Update the display title on a workout plan
    fun updateDisplayTitle(workoutId: Long, title: String): WorkoutPlan? {
        val workout = workoutPlanRepository.findById(workoutId).orElse(null) ?: return null
        val updated = workout.copy(displayTitle = title, updatedAt = LocalDateTime.now())
        return workoutPlanRepository.save(updated)
    }

    // Delete workout entirely
    fun deleteWorkout(workoutId: Long, userId: Long) {
        val workout = workoutPlanRepository.findById(workoutId).orElse(null)
        
        if (workout != null && workout.user.id == userId) {
            workoutPlanRepository.delete(workout)
        } else {
            throw IllegalArgumentException("Workout not found or does not belong to user")
        }
    }
    
    // Get only user's saved/bookmarked workouts
    fun getUserSavedWorkouts(userId: Long): List<WorkoutPlan> {
        return workoutPlanRepository.findByUserId(userId).filter { it.isSaved }
    }
    
    // Get user's recent workout plans (last 10)
    fun getUserRecentWorkouts(userId: Long): List<WorkoutPlan> {
        return workoutPlanRepository.findByUserId(userId)
            .sortedByDescending { it.createdAt }
            .take(10)
    }
    
    // Get workout plans by sport for user
    fun getUserWorkoutsBySport(userId: Long, sport: Sport): List<WorkoutPlan> {
        return workoutPlanRepository.findByUserId(userId)
            .filter { it.sport == sport }
    }
    
    // Get workout plans by position for user
    fun getUserWorkoutsByPosition(userId: Long, position: Position): List<WorkoutPlan> {
        return workoutPlanRepository.findByUserId(userId)
            .filter { it.position == position }
    }

    fun updateExerciseVideo(workoutId: Long, exerciseName: String, videoId: String, videoUrl: String, videoTitle: String? = null): WorkoutPlan? {
        val workout = workoutPlanRepository.findById(workoutId).orElse(null) ?: return null

        val generatedContent = workout.generatedContent ?: return null

        val workoutData = objectMapper.readTree(generatedContent)
        val exercisesNode = workoutData.get("exercises") ?: workoutData.get("mainExercises") ?: return null

        if (!exercisesNode.isArray) return null

        var found = false
        for (exerciseNode in exercisesNode) {
            val name = exerciseNode.get("name")?.asText() ?: continue
            if (name.equals(exerciseName, ignoreCase = true)) {
                (exerciseNode as ObjectNode).put("videoId", videoId)
                (exerciseNode as ObjectNode).put("videoUrl", videoUrl)
                if (!videoTitle.isNullOrBlank()) {
                    (exerciseNode as ObjectNode).put("videoTitle", videoTitle)
                }
                found = true
                break
            }
        }

        if (!found) return null

        val updatedContent = objectMapper.writeValueAsString(workoutData)
        val updatedWorkout = workout.copy(
            generatedContent = updatedContent,
            updatedAt = LocalDateTime.now()
        )
        return workoutPlanRepository.save(updatedWorkout)
    }
}