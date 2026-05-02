package com.gameiq.repository

import com.gameiq.entity.ConversationTag
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface ConversationTagRepository : JpaRepository<ConversationTag, Long> {
    fun findByTagId(tagId: Long): List<ConversationTag>
    fun findByConversationId(conversationId: Long): List<ConversationTag>
    fun existsByConversationIdAndTagId(conversationId: Long, tagId: Long): Boolean
    fun deleteByConversationIdAndTagId(conversationId: Long, tagId: Long)
}