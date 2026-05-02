package com.gameiq.entity

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "quiz_session_question_results")
data class QuizSessionQuestionResult(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_attempt_id", nullable = false)
    val sessionAttempt: QuizSessionAttempt,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    val question: QuizQuestion,

    @Column(name = "question_number", nullable = false)
    val questionNumber: Int, // Position in the quiz (1-15)

    @Column(name = "answer_selected", nullable = false, length = 10)
    val answerSelected: String,

    @Column(name = "is_correct", nullable = false)
    val isCorrect: Boolean,

    @Column(name = "time_taken")
    val timeTaken: Int? = null, // Time for this individual question in seconds

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now()
)