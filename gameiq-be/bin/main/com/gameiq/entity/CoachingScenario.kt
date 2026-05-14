package com.gameiq.entity

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "coaching_scenarios")
data class CoachingScenario(
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    
    @Column(name = "sport", nullable = false)
    val sport: String,
    
    @Column(name = "scenario_type", nullable = false)
    val scenarioType: String,
    
    @Column(name = "description", columnDefinition = "TEXT")
    val description: String,
    
    @Column(name = "context_factors", columnDefinition = "TEXT")
    val contextFactors: String,
    
    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
)
