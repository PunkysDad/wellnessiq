package com.gameiq.entity

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "quiz_results")
data class QuizResult(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,
    
    // Keep existing question_id for backwards compatibility
    @Column(name = "question_id")
    val questionId: Long? = null,
    
    // Add relationship mapping that QuizQuestion expects
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", insertable = false, updatable = false)
    val question: QuizQuestion? = null,
    
    // New fields from your updated schema
    @Enumerated(EnumType.STRING)
    @Column(name = "sport")
    val sport: Sport? = null,
    
    @Enumerated(EnumType.STRING)
    @Column(name = "position")
    val position: Position? = null,
    
    @Enumerated(EnumType.STRING)
    @Column(name = "quiz_type", nullable = false)
    val quizType: QuizType,
    
    @Column(name = "quiz_title", nullable = false)
    val quizTitle: String,
    
    @Column(name = "questions_json", columnDefinition = "TEXT", nullable = false)
    val questionsJson: String, // JSON array of questions and answers
    
    @Column(name = "user_answers_json", columnDefinition = "TEXT", nullable = false)
    val userAnswersJson: String, // JSON array of user's selected answers
    
    @Column(name = "correct_answers", nullable = false)
    val correctAnswers: Int,
    
    @Column(name = "total_questions", nullable = false)
    val totalQuestions: Int,
    
    @Column(name = "score_percentage", nullable = false)
    val scorePercentage: Double, // calculated field: (correctAnswers/totalQuestions) * 100
    
    // Keep original score field for backwards compatibility
    @Column(name = "score", nullable = false)
    val score: Int = correctAnswers,
    
    @Column(name = "time_taken_seconds")
    val timeTakenSeconds: Int? = null,
    
    // Keep original time_taken for backwards compatibility
    @Column(name = "time_taken")
    val timeTaken: Int? = timeTakenSeconds,
    
    @Column(name = "difficulty_level", nullable = false)
    @Enumerated(EnumType.STRING)
    val difficultyLevel: DifficultyLevel,
    
    @Column(name = "generated_by_claude", nullable = false)
    val generatedByClaude: Boolean = true,
    
    @Column(name = "shared_to_facebook", nullable = false)
    val sharedToFacebook: Boolean = false,
    
    @Column(name = "shared_to_tiktok", nullable = false)
    val sharedToTiktok: Boolean = false,
    
    @Column(name = "answer_selected", nullable = false)
    val answerSelected: String = "", // Keep for backwards compatibility
    
    @Column(name = "is_correct", nullable = false)
    val isCorrect: Boolean = false, // Keep for backwards compatibility
    
    @Column(name = "completed_at", nullable = false)
    val completedAt: LocalDateTime = LocalDateTime.now(),
    
    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    
    @Column(name = "updated_at")
    val updatedAt: LocalDateTime? = null
)

// Note: QuizType and DifficultyLevel enums are defined elsewhere in the project