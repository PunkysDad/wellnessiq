package com.gameiq.entity

import jakarta.persistence.*

@Entity
@Table(name = "workout_plan_tags")
data class WorkoutPlanTag(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "workout_plan_id", nullable = false)
    val workoutPlanId: Long,

    @Column(name = "tag_id", nullable = false)
    val tagId: Long
)