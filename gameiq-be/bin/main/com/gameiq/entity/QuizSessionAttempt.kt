package com.gameiq.entity

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.time.Instant

@Entity
@Table(
    name = "quiz_session_attempts",
    uniqueConstraints = [
        UniqueConstraint(columnNames = ["quiz_session_id", "attempt_number"])
    ]
)
data class QuizSessionAttempt(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quiz_session_id", nullable = false)
    @JsonIgnoreProperties("attempts")
    val quizSession: QuizSession,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnoreProperties("quizSessionAttempts")
    val user: User,

    @Column(name = "attempt_number", nullable = false)
    val attemptNumber: Int,

    @Column(name = "total_score", nullable = false)
    val totalScore: Int = 0, // 0-100

    @Column(name = "correct_answers", nullable = false)
    val correctAnswers: Int = 0, // Number correct out of total questions

    @Column(name = "time_taken")
    val timeTaken: Int? = null, // Total time in seconds

    @Column(name = "completed_at", nullable = false)
    val completedAt: Instant = Instant.now(),

    @OneToMany(mappedBy = "sessionAttempt", cascade = [CascadeType.ALL], fetch = FetchType.LAZY)
    val questionResults: List<QuizSessionQuestionResult> = emptyList(),

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()
)