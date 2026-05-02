package com.gameiq.repository

import com.gameiq.entity.ClaudeConversation
import com.gameiq.entity.User
import com.gameiq.entity.Sport
import com.gameiq.entity.Position
import com.gameiq.entity.ConversationType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface ClaudeConversationRepository : JpaRepository<ClaudeConversation, Long> {
    
    // User-specific queries
    fun findByUser(user: User): List<ClaudeConversation>
    fun findByUserId(userId: Long): List<ClaudeConversation>
    
    // Session-based queries (for conversation threading)
    fun findBySessionId(sessionId: String): List<ClaudeConversation>
    fun findByUserAndSessionId(user: User, sessionId: String): List<ClaudeConversation>
    
    // Sport and position queries
    fun findBySport(sport: Sport): List<ClaudeConversation>
    fun findByPosition(position: Position): List<ClaudeConversation>
    fun findBySportAndPosition(sport: Sport, position: Position): List<ClaudeConversation>
    fun findByUserAndSport(user: User, sport: Sport): List<ClaudeConversation>
    fun findByUserAndSportAndPosition(user: User, sport: Sport, position: Position): List<ClaudeConversation>
    
    // Conversation type queries
    fun findByConversationType(conversationType: ConversationType): List<ClaudeConversation>
    fun findByUserAndConversationType(user: User, conversationType: ConversationType): List<ClaudeConversation>
    
    // Recent conversations
    fun findByCreatedAtAfter(createdAt: LocalDateTime): List<ClaudeConversation>
    fun findByUserAndCreatedAtAfter(user: User, createdAt: LocalDateTime): List<ClaudeConversation>
    fun findByUserAndCreatedAtBetween(user: User, start: LocalDateTime, end: LocalDateTime): List<ClaudeConversation>
    
    // User's conversation history
    @Query("""
        SELECT cc FROM ClaudeConversation cc 
        WHERE cc.user = :user 
        ORDER BY cc.createdAt DESC
    """)
    fun findRecentConversationsByUser(@Param("user") user: User): List<ClaudeConversation>
    
    // Session conversations ordered by time
    @Query("""
        SELECT cc FROM ClaudeConversation cc 
        WHERE cc.sessionId = :sessionId 
        ORDER BY cc.createdAt ASC
    """)
    fun findConversationsBySessionOrdered(@Param("sessionId") sessionId: String): List<ClaudeConversation>
    
    // User ratings
    fun findByUserRatingGreaterThanEqual(userRating: Int): List<ClaudeConversation>
    fun findByUserAndUserRatingGreaterThanEqual(user: User, userRating: Int): List<ClaudeConversation>
    
    // Flagged conversations
    fun findByFlaggedInappropriateTrue(): List<ClaudeConversation>
    fun findByUserAndFlaggedInappropriateTrue(user: User): List<ClaudeConversation>
    
    // API cost tracking
    @Query("""
        SELECT SUM(cc.apiCostCents) FROM ClaudeConversation cc 
        WHERE cc.user = :user
    """)
    fun getTotalCostByUser(@Param("user") user: User): Long?
    
    @Query("""
        SELECT SUM(cc.apiCostCents) FROM ClaudeConversation cc 
        WHERE cc.user = :user 
        AND cc.createdAt >= :since
    """)
    fun getCostByUserSince(@Param("user") user: User, @Param("since") since: LocalDateTime): Long?
    
    @Query("""
        SELECT SUM(cc.apiCostCents) FROM ClaudeConversation cc 
        WHERE cc.createdAt >= :start 
        AND cc.createdAt < :end
    """)
    fun getTotalCostBetween(@Param("start") start: LocalDateTime, @Param("end") end: LocalDateTime): Long?
    
    // Token usage analytics
    @Query("""
        SELECT SUM(cc.tokensUsedInput), SUM(cc.tokensUsedOutput) 
        FROM ClaudeConversation cc 
        WHERE cc.user = :user
    """)
    fun getTokenUsageByUser(@Param("user") user: User): Array<Long?>?
    
    @Query("""
        SELECT AVG(cc.responseTimeMs) FROM ClaudeConversation cc 
        WHERE cc.user = :user 
        AND cc.responseTimeMs IS NOT NULL
    """)
    fun getAverageResponseTimeByUser(@Param("user") user: User): Double?
    
    // Conversation count queries
    @Query("SELECT COUNT(cc) FROM ClaudeConversation cc WHERE cc.user = :user")
    fun countConversationsByUser(@Param("user") user: User): Long
    
    @Query("SELECT COUNT(cc) FROM ClaudeConversation cc WHERE cc.user = :user AND cc.createdAt >= :since")
    fun countConversationsByUserSince(@Param("user") user: User, @Param("since") since: LocalDateTime): Long
    
    @Query("SELECT COUNT(DISTINCT cc.sessionId) FROM ClaudeConversation cc WHERE cc.user = :user")
    fun countUniqueSessionsByUser(@Param("user") user: User): Long

    @Query("""
        SELECT COUNT(DISTINCT cc.sessionId) FROM ClaudeConversation cc
        WHERE cc.user.id = :userId
        AND cc.conversationType != com.gameiq.entity.ConversationType.WORKOUT_CUSTOMIZATION
    """)
    fun countChatConversationsByUserId(@Param("userId") userId: Long): Long
    
    // Popular conversation types
    @Query("""
        SELECT cc.conversationType, COUNT(cc) FROM ClaudeConversation cc 
        WHERE cc.user = :user 
        GROUP BY cc.conversationType 
        ORDER BY COUNT(cc) DESC
    """)
    fun getConversationTypeDistributionByUser(@Param("user") user: User): List<Array<Any>>
    
    // Usage patterns
    @Query("""
        SELECT DATE(cc.createdAt), COUNT(cc) FROM ClaudeConversation cc 
        WHERE cc.user = :user 
        AND cc.createdAt >= :since
        GROUP BY DATE(cc.createdAt) 
        ORDER BY DATE(cc.createdAt) DESC
    """)
    fun getDailyUsageByUser(@Param("user") user: User, @Param("since") since: LocalDateTime): List<Array<Any>>
    
    // Most helpful conversations (high rated)
    @Query("""
        SELECT cc FROM ClaudeConversation cc 
        WHERE cc.userRating >= 4 
        AND cc.conversationType = :conversationType
        ORDER BY cc.userRating DESC, cc.createdAt DESC
    """)
    fun findMostHelpfulByType(@Param("conversationType") conversationType: ConversationType): List<ClaudeConversation>
}