package com.gameiq.entity

import jakarta.persistence.*
import java.time.LocalDateTime

// Top-level enums - accessible to other files
enum class DifficultyLevel {
    BEGINNER, INTERMEDIATE, ADVANCED, ELITE
}

enum class TrainingPhase {
    OFF_SEASON, PRE_SEASON, IN_SEASON, POST_SEASON, INJURY_PREVENTION, REHABILITATION, GENERAL
}

@Entity
@Table(name = "workout_plans")
data class WorkoutPlan(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,
    
    @Enumerated(EnumType.STRING)
    @Column(name = "sport", nullable = false)
    val sport: Sport,
    
    @Enumerated(EnumType.STRING)
    @Column(name = "position")
    val position: Position? = null,
    
    @Column(name = "workout_name", length = 255)
    val workoutName: String? = null,
    
    @Column(name = "position_focus", length = 255)
    val positionFocus: String? = null,
    
    @Column(name = "difficulty_level", length = 20)
    val difficultyLevel: String? = null,
    
    @Column(name = "duration_minutes")
    val durationMinutes: Int? = null,
    
    @Column(name = "equipment_needed", columnDefinition = "TEXT")
    val equipmentNeeded: String? = null,
    
    @Column(name = "generated_content", columnDefinition = "TEXT")
    val generatedContent: String? = null,
    
    @Column(name = "is_saved", nullable = false)
    val isSaved: Boolean = false,
    
    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    val updatedAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "display_title")
    val displayTitle: String? = null
) {
    // Override equals and hashCode to work properly with JPA
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as WorkoutPlan
        return id != 0L && id == other.id
    }
    
    override fun hashCode(): Int = javaClass.hashCode()
    
    // Custom toString to avoid lazy loading issues
    override fun toString(): String {
        return "WorkoutPlan(id=$id, workoutName='$workoutName', sport=$sport, position=$position)"
    }
}