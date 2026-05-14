package com.gameiq.entity

import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.time.Instant

@Entity
@Table(
    name = "quiz_categories",
    uniqueConstraints = [
        UniqueConstraint(columnNames = ["sport", "position", "category_name"])
    ]
)
data class QuizCategory(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 50)
    val sport: String,

    @Column(nullable = false, length = 50)
    val position: String,

    @Column(name = "category_name", nullable = false, length = 100)
    val categoryName: String,

    @Column(columnDefinition = "TEXT")
    val description: String? = null,

    @OneToMany(mappedBy = "category", cascade = [CascadeType.ALL], fetch = FetchType.LAZY)
    val questions: List<QuizQuestion> = emptyList(),

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    val updatedAt: Instant = Instant.now()
)