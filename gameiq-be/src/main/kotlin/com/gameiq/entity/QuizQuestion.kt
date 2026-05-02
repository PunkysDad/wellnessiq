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
    name = "quiz_questions",
    uniqueConstraints = [
        UniqueConstraint(columnNames = ["category_id", "question_id"])
    ]
)
data class QuizQuestion(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    @JsonIgnoreProperties("questions")
    val category: QuizCategory,

    @Column(name = "question_id", nullable = false, length = 50)
    val questionId: String,

    @Column(columnDefinition = "TEXT", nullable = false)
    val scenario: String,

    @Column(columnDefinition = "TEXT", nullable = false)
    val question: String,

    @Type(JsonType::class)
    @Column(columnDefinition = "jsonb", nullable = false)
    val options: List<QuizOption>,

    @Column(nullable = false, length = 10)
    val correct: String,

    @Column(columnDefinition = "TEXT", nullable = false)
    val explanation: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    val difficulty: QuizDifficulty,

    @Type(JsonType::class)
    @Column(columnDefinition = "jsonb")
    val tags: List<String> = emptyList(),

    @OneToMany(mappedBy = "question", cascade = [CascadeType.ALL], fetch = FetchType.LAZY)
    val results: List<QuizResult> = emptyList(),

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    val updatedAt: Instant = Instant.now()
)

data class QuizOption(
    val id: String,
    val text: String
)

enum class QuizDifficulty {
    BEGINNER, INTERMEDIATE, ADVANCED
}