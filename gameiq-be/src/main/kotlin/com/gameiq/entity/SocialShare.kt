package com.gameiq.entity

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.Type
import org.hibernate.annotations.UpdateTimestamp
import java.time.Instant

@Entity
@Table(name = "social_shares")
data class SocialShare(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnoreProperties("socialShares")
    val user: User,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quiz_result_id", nullable = false)
    @JsonIgnoreProperties("socialShares")
    val quizResult: QuizResult,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    val platform: SocialPlatform,

    @Column(name = "shared_at", nullable = false)
    val sharedAt: Instant = Instant.now(),

    @Type(JsonType::class)
    @Column(name = "share_data", columnDefinition = "jsonb")
    val shareData: Map<String, Any>? = null, // Additional data about the share

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    val updatedAt: Instant = Instant.now()
)

enum class SocialPlatform {
    FACEBOOK, TIKTOK, INSTAGRAM, TWITTER
}