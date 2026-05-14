package com.gameiq.entity

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "users")
data class User(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(unique = true, nullable = false)
    val email: String,

    @Column(name = "firebase_uid", unique = true, nullable = false)
    val firebaseUid: String,

    @Column(name = "display_name", nullable = false)
    val displayName: String,

    @Column(name = "first_name")
    val firstName: String? = null,

    @Column(name = "last_name")
    val lastName: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "subscription_tier", nullable = false)
    val subscriptionTier: SubscriptionTier = SubscriptionTier.TRIAL,

    @Enumerated(EnumType.STRING)
    @Column(name = "primary_sport")
    val primarySport: Sport? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "primary_position")
    val primaryPosition: Position? = null,

    @Column(name = "age")
    val age: Int? = null,

    @Column(name = "trial_chats_used", nullable = false)
    val trialChatsUsed: Int = 0,

    @Column(name = "trial_workouts_used", nullable = false)
    val trialWorkoutsUsed: Int = 0,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    val updatedAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "last_active_at")
    val lastActiveAt: LocalDateTime? = null,

    @Column(name = "is_active", nullable = false)
    val isActive: Boolean = true,

    @Column(name = "deleted_at")
    val deletedAt: LocalDateTime? = null,

    @Column(name = "fitness_goals", columnDefinition = "TEXT")
    val fitnessGoals: String = ""
) {
    fun getFitnessGoalsList(): List<String> =
        if (fitnessGoals.isBlank()) emptyList() else fitnessGoals.split(",").map { it.trim() }
}

enum class SubscriptionTier {
    TRIAL, NONE, BASIC, PREMIUM
}

enum class Sport {
    FOOTBALL, BASKETBALL, BASEBALL, SOCCER, HOCKEY, GENERAL_FITNESS
}

enum class Position {
    // Football
    QB, RB, WR, OL, TE, LB, DB, DL,
    // Basketball
    PG, SG, SF, PF, C,
    // Baseball
    PITCHER, CATCHER, INFIELD, OUTFIELD,
    // Soccer
    GOALKEEPER, DEFENDER, MIDFIELDER, FORWARD,
    // Hockey
    CENTER, WINGER, DEFENSEMAN, GOALIE
}