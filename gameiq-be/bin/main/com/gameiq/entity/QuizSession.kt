package com.gameiq.entity

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.Type
import org.hibernate.annotations.UpdateTimestamp
import java.time.Instant

@Entity
@Table(
    name = "quiz_sessions",
    uniqueConstraints = [
        UniqueConstraint(columnNames = ["user_id", "session_name"])
    ]
)
data class QuizSession(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnoreProperties("quizSessions")
    val user: User,

    @Enumerated(EnumType.STRING)
    @Column(name = "quiz_type", nullable = false)
    val quizType: QuizType,

    @Column(nullable = false, length = 50)
    val sport: String,

    @Column(nullable = false, length = 50)
    val position: String,

    @Type(JsonType::class)
    @Column(name = "question_ids", columnDefinition = "jsonb", nullable = false)
    val questionIds: List<Long>, // Array of question IDs for this quiz

    @Column(name = "session_name", nullable = false, length = 200)
    val sessionName: String, // e.g., "Core Quarterback Quiz"

    @Column(name = "is_completed", nullable = false)
    val isCompleted: Boolean = false,

    @Column(name = "best_score", nullable = false)
    val bestScore: Int = 0, // 0-100

    @Column(name = "best_attempt_id")
    val bestAttemptId: Long? = null,

    @Column(name = "total_attempts", nullable = false)
    val totalAttempts: Int = 0,

    @Column(nullable = false)
    val passed: Boolean = false, // TRUE if bestScore >= 70

    @OneToMany(mappedBy = "quizSession", cascade = [CascadeType.ALL], fetch = FetchType.LAZY)
    val attempts: List<QuizSessionAttempt> = emptyList(),

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    val updatedAt: Instant = Instant.now()
)

enum class QuizType {
    CORE,      // Pre-built core quizzes (must pass with 70% before generating)
    GENERATED  // AI-generated quizzes (unlocked after passing previous quiz)
}