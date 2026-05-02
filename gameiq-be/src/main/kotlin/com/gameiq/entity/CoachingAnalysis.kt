package com.gameiq.entity

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "coaching_analysis")
data class CoachingAnalysis(
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY) 
    val id: Long = 0,
    
    @Column(name = "user_id", nullable = false)
    val userId: Long,
    
    @Column(name = "sport", nullable = false)
    val sport: String,
    
    @Column(name = "scenario", columnDefinition = "TEXT")
    val scenario: String,
    
    @Column(name = "recommendation", columnDefinition = "TEXT")
    val recommendation: String,
    
    @Column(name = "success_probability")
    val successProbability: String,
    
    @Column(name = "reasoning", columnDefinition = "TEXT")
    val reasoning: String,
    
    @Column(name = "alternatives", columnDefinition = "TEXT")
    val alternatives: String,
    
    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
)
