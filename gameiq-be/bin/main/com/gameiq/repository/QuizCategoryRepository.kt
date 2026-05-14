package com.gameiq.repository

import com.gameiq.entity.QuizCategory
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface QuizCategoryRepository : JpaRepository<QuizCategory, Long> {
    fun findBySportAndPosition(sport: String, position: String): List<QuizCategory>
    fun findBySport(sport: String): List<QuizCategory>
    fun existsBySportAndPositionAndCategoryName(sport: String, position: String, categoryName: String): Boolean
    fun findBySportAndPositionAndCategoryName(sport: String, position: String, categoryName: String): QuizCategory?
}