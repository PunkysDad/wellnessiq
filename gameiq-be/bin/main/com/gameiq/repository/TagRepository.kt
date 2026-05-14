package com.gameiq.repository

import com.gameiq.entity.Tag
import com.gameiq.entity.User
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface TagRepository : JpaRepository<Tag, Long> {
    
    /**
     * Find all tags for a specific user
     */
    fun findByUserOrderByNameAsc(user: User): List<Tag>
    
    /**
     * Find all tags for a specific user by user ID
     */
    fun findByUserIdOrderByNameAsc(userId: Long): List<Tag>
    
    /**
     * Find a tag by user and name (case-insensitive)
     */
    @Query("SELECT t FROM Tag t WHERE t.user = :user AND LOWER(t.name) = LOWER(:name)")
    fun findByUserAndNameIgnoreCase(@Param("user") user: User, @Param("name") name: String): Tag?
    
    /**
     * Find a tag by user ID and name (case-insensitive)
     */
    @Query("SELECT t FROM Tag t WHERE t.user.id = :userId AND LOWER(t.name) = LOWER(:name)")
    fun findByUserIdAndNameIgnoreCase(@Param("userId") userId: Long, @Param("name") name: String): Tag?
    
    /**
     * Check if a tag name already exists for a user (case-insensitive)
     */
    @Query("SELECT COUNT(t) > 0 FROM Tag t WHERE t.user.id = :userId AND LOWER(t.name) = LOWER(:name)")
    fun existsByUserIdAndNameIgnoreCase(@Param("userId") userId: Long, @Param("name") name: String): Boolean
    
    /**
     * Search tags by name pattern for a user
     */
    @Query("SELECT t FROM Tag t WHERE t.user.id = :userId AND LOWER(t.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) ORDER BY t.name ASC")
    fun searchByUserIdAndName(@Param("userId") userId: Long, @Param("searchTerm") searchTerm: String): List<Tag>
    
    /**
     * Count total tags for a user
     */
    fun countByUserId(userId: Long): Long
    
    /**
     * Delete all tags for a user
     */
    fun deleteByUserId(userId: Long): Long
}