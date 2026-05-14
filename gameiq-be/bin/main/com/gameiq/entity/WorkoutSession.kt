package com.gameiq.entity

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "workout_sessions")
data class WorkoutSession(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workout_plan_id", nullable = false)
    val workoutPlan: WorkoutPlan,
    
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    val status: WorkoutStatus,
    
    @Column(name = "started_at")
    val startedAt: LocalDateTime? = null,
    
    @Column(name = "completed_at")
    val completedAt: LocalDateTime? = null,
    
    @Column(name = "duration_minutes")
    val durationMinutes: Int? = null,
    
    @Column(name = "exercises_completed_json", columnDefinition = "TEXT")
    val exercisesCompletedJson: String? = null, // JSON of completed exercises with reps/sets
    
    @Column(name = "notes", columnDefinition = "TEXT")
    val notes: String? = null,
    
    @Column(name = "difficulty_rating") // 1-5 scale
    val difficultyRating: Int? = null,
    
    @Column(name = "effectiveness_rating") // 1-5 scale
    val effectivenessRating: Int? = null,
    
    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    
    @Column(name = "updated_at", nullable = false)
    val updatedAt: LocalDateTime = LocalDateTime.now()
)

enum class WorkoutStatus {
    PLANNED, IN_PROGRESS, COMPLETED, SKIPPED, CANCELLED
}