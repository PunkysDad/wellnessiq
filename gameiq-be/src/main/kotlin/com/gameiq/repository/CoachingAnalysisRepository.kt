package com.gameiq.repository

import com.gameiq.entity.CoachingAnalysis
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface CoachingAnalysisRepository : JpaRepository<CoachingAnalysis, Long> {
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<CoachingAnalysis>
    fun findByUserIdAndSport(userId: Long, sport: String): List<CoachingAnalysis>
}
