package com.gameiq.repository

import com.gameiq.entity.QuizQuestion
import com.gameiq.entity.QuizCategory
import com.gameiq.entity.QuizDifficulty
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface QuizQuestionRepository : JpaRepository<QuizQuestion, Long> {
    fun findByCategoryId(categoryId: Long): List<QuizQuestion>
    fun findByCategoryIdAndDifficulty(categoryId: Long, difficulty: QuizDifficulty): List<QuizQuestion>
    fun findByCategoryAndQuestionId(category: QuizCategory, questionId: String): QuizQuestion?
    
    @Query("SELECT qq FROM QuizQuestion qq WHERE qq.category.sport = :sport AND qq.category.position = :position")
    fun findBySportAndPosition(@Param("sport") sport: String, @Param("position") position: String): List<QuizQuestion>
    
    @Query("SELECT qq FROM QuizQuestion qq WHERE qq.category.sport = :sport AND qq.category.position = :position AND qq.difficulty = :difficulty")
    fun findBySportAndPositionAndDifficulty(
        @Param("sport") sport: String, 
        @Param("position") position: String, 
        @Param("difficulty") difficulty: QuizDifficulty
    ): List<QuizQuestion>
    
    // Find questions that contain any of the specified tags
    @Query(value = "SELECT DISTINCT * FROM quiz_questions qq WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(qq.tags) AS tag WHERE tag = ANY(:tags))", nativeQuery = true)
    fun findByTagsContaining(@Param("tags") tags: List<String>): List<QuizQuestion>
}