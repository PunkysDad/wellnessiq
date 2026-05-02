package com.gameiq.entity

import jakarta.persistence.*
import java.time.LocalDate
import java.time.LocalDateTime

@Entity
@Table(name = "progress_metrics")
data class ProgressMetrics(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,
    
    @Column(name = "metric_date", nullable = false)
    val metricDate: LocalDate,
    
    @Enumerated(EnumType.STRING)
    @Column(name = "sport", nullable = false)
    val sport: Sport,
    
    @Enumerated(EnumType.STRING)
    @Column(name = "position")
    val position: Position? = null,
    
    // IQ Metrics
    @Column(name = "avg_quiz_score_percentage")
    val avgQuizScorePercentage: Double? = null,
    
    @Column(name = "quizzes_completed_count")
    val quizzesCompletedCount: Int = 0,
    
    @Column(name = "current_iq_streak_days")
    val currentIqStreakDays: Int = 0,
    
    @Column(name = "longest_iq_streak_days")
    val longestIqStreakDays: Int = 0,
    
    // Training Metrics
    @Column(name = "workouts_completed_count")
    val workoutsCompletedCount: Int = 0,
    
    @Column(name = "total_training_minutes")
    val totalTrainingMinutes: Int = 0,
    
    @Column(name = "current_training_streak_days")
    val currentTrainingStreakDays: Int = 0,
    
    @Column(name = "longest_training_streak_days")
    val longestTrainingStreakDays: Int = 0,
    
    // Engagement Metrics
    @Column(name = "claude_conversations_count")
    val claudeConversationsCount: Int = 0,
    
    @Column(name = "total_app_time_minutes")
    val totalAppTimeMinutes: Int = 0,
    
    @Column(name = "days_active_this_week")
    val daysActiveThisWeek: Int = 0,
    
    @Column(name = "achievement_badges_earned")
    val achievementBadgesEarned: String? = null, // JSON array of badge IDs
    
    // Performance Indicators
    @Column(name = "improvement_score") // Calculated field showing overall improvement
    val improvementScore: Double? = null,
    
    @Column(name = "position_mastery_percentage")
    val positionMasteryPercentage: Double? = null,
    
    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    
    @Column(name = "updated_at", nullable = false)
    val updatedAt: LocalDateTime = LocalDateTime.now()
)