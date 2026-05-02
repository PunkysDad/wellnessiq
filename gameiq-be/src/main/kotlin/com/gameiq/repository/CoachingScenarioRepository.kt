package com.gameiq.repository

import com.gameiq.entity.CoachingScenario
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface CoachingScenarioRepository : JpaRepository<CoachingScenario, Long> {
    fun findBySport(sport: String): List<CoachingScenario>
    fun findByScenarioType(scenarioType: String): List<CoachingScenario>
    fun findBySportAndScenarioType(sport: String, scenarioType: String): List<CoachingScenario>
}
