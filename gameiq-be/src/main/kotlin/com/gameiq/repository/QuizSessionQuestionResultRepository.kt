package com.gameiq.repository

import com.gameiq.entity.QuizSessionQuestionResult
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface QuizSessionQuestionResultRepository : JpaRepository<QuizSessionQuestionResult, Long> {
    
    // Find question results for an attempt
    fun findBySessionAttemptIdOrderByQuestionNumber(sessionAttemptId: Long): List<QuizSessionQuestionResult>
    
    // Find specific question result
    fun findBySessionAttemptIdAndQuestionNumber(sessionAttemptId: Long, questionNumber: Int): QuizSessionQuestionResult?
}