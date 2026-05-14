package com.gameiq.entity

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(
    name = "tags",
    uniqueConstraints = [
        UniqueConstraint(
            name = "tags_user_name_unique", 
            columnNames = ["user_id", "name"]
        )
    ]
)
data class Tag(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,
    
    @Column(name = "name", nullable = false, length = 100)
    val name: String,
    
    @Column(name = "color", nullable = false, length = 7)
    val color: String = "#007AFF", // Default blue color
    
    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    
    @Column(name = "updated_at", nullable = false)
    val updatedAt: LocalDateTime = LocalDateTime.now()
) {
    // Override equals and hashCode to work properly with JPA
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as Tag
        return id != 0L && id == other.id
    }
    
    override fun hashCode(): Int = javaClass.hashCode()
    
    // Custom toString to avoid lazy loading issues
    override fun toString(): String {
        return "Tag(id=$id, name='$name', color='$color', createdAt=$createdAt)"
    }
}