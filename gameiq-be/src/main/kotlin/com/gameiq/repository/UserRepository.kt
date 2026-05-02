package com.gameiq.repository

import com.gameiq.entity.User
import com.gameiq.entity.SubscriptionTier
import com.gameiq.entity.Sport
import com.gameiq.entity.Position
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime
import java.util.*

@Repository
interface UserRepository : JpaRepository<User, Long> {
    
    // Firebase authentication lookup
    fun findByFirebaseUid(firebaseUid: String): User?
    
    // Email-based lookups
    fun findByEmail(email: String): User?
    fun existsByEmail(email: String): Boolean
    
    // Subscription tier queries
    fun findBySubscriptionTier(subscriptionTier: SubscriptionTier): List<User>
    fun countBySubscriptionTier(subscriptionTier: SubscriptionTier): Long
    
    // Sport and position queries
    fun findByPrimarySport(primarySport: Sport): List<User>
    fun findByPrimaryPosition(primaryPosition: Position): List<User>
    fun findByPrimarySportAndPrimaryPosition(primarySport: Sport, primaryPosition: Position): List<User>
    
    // Active users
    fun findByIsActiveTrue(): List<User>
    fun findByIsActiveFalse(): List<User>
    
    // Activity-based queries
    fun findByLastActiveAtAfter(lastActiveAt: LocalDateTime): List<User>
    
    @Query("SELECT u FROM User u WHERE u.lastActiveAt >= :since AND u.isActive = true")
    fun findActiveUsersSince(@Param("since") since: LocalDateTime): List<User>
    
    // Age-based queries
    fun findByAgeBetween(minAge: Int, maxAge: Int): List<User>
    
    // Registration date queries
    fun findByCreatedAtAfter(createdAt: LocalDateTime): List<User>
    fun findByCreatedAtBetween(start: LocalDateTime, end: LocalDateTime): List<User>
    
    // Analytics queries
    @Query("SELECT COUNT(u) FROM User u WHERE u.createdAt >= :start AND u.createdAt < :end")
    fun countUsersCreatedBetween(@Param("start") start: LocalDateTime, @Param("end") end: LocalDateTime): Long
    
    @Query("SELECT u.subscriptionTier, COUNT(u) FROM User u GROUP BY u.subscriptionTier")
    fun getSubscriptionTierCounts(): List<Array<Any>>
    
    @Query("SELECT u.primarySport, COUNT(u) FROM User u WHERE u.primarySport IS NOT NULL GROUP BY u.primarySport")
    fun getSportDistribution(): List<Array<Any>>
}