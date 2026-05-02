package com.gameiq.entity

import jakarta.persistence.*

@Entity
@Table(name = "conversation_tags")
data class ConversationTag(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "conversation_id", nullable = false)
    val conversationId: Long,

    @Column(name = "tag_id", nullable = false)
    val tagId: Long
)