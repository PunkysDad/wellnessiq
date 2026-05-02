package com.gameiq.repository

import com.gameiq.entity.WorkoutPlanTag
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface WorkoutPlanTagRepository : JpaRepository<WorkoutPlanTag, Long> {
    fun findByTagId(tagId: Long): List<WorkoutPlanTag>
    fun findByWorkoutPlanId(workoutPlanId: Long): List<WorkoutPlanTag>
    fun existsByWorkoutPlanIdAndTagId(workoutPlanId: Long, tagId: Long): Boolean
    fun deleteByWorkoutPlanIdAndTagId(workoutPlanId: Long, tagId: Long)
}