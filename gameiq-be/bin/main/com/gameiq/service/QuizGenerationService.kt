package com.gameiq.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.gameiq.entity.*
import com.gameiq.repository.QuizCategoryRepository
import com.gameiq.repository.QuizQuestionRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType

@Service
class QuizGenerationService(
    private val quizCategoryRepository: QuizCategoryRepository,
    private val quizQuestionRepository: QuizQuestionRepository,
    private val objectMapper: ObjectMapper,
    @Value("\${claude.api.key}") private val claudeApiKey: String,
    @Value("\${claude.api.url:https://api.anthropic.com/v1/messages}") private val claudeApiUrl: String
) {
    private val logger = LoggerFactory.getLogger(QuizGenerationService::class.java)
    private val restTemplate = RestTemplate()

    fun getRandomQuestions(sport: String, position: String, count: Int): List<com.gameiq.entity.QuizQuestion> {
        val allQuestions = quizQuestionRepository.findBySportAndPosition(sport, position)
        
        if (allQuestions.size <= count) {
            return allQuestions.shuffled()
        }
        
        return allQuestions.shuffled().take(count)
    }

    fun generateNewQuizQuestions(sport: String, position: String, existingQuestionIds: List<Long>): List<QuizQuestion> {
        logger.info("Generating 15 new quiz questions for $sport $position")
        
        // Get existing questions for context (but avoid duplicating)
        val existingQuestions = if (existingQuestionIds.isNotEmpty()) {
            quizQuestionRepository.findAllById(existingQuestionIds)
        } else {
            emptyList()
        }
        
        // Get categories for this sport/position to understand structure
        val categories = quizCategoryRepository.findBySportAndPosition(sport, position)
        
        if (categories.isEmpty()) {
            throw IllegalArgumentException("No categories found for $sport/$position")
        }
        
        // Generate new questions using Claude API
        val generatedQuestions = callClaudeForQuizGeneration(sport, position, categories, existingQuestions)
        
        // Save generated questions to database
        val savedQuestions = generatedQuestions.map { questionData ->
            // Find appropriate category or create a "Generated" category
            val category = findOrCreateGeneratedCategory(sport, position, questionData.categoryHint)
            
            val question = QuizQuestion(
                category = category,
                questionId = "generated_${System.currentTimeMillis()}_${questionData.id}",
                scenario = questionData.scenario,
                question = questionData.question,
                options = questionData.options.map { QuizOption(it.id, it.text) },
                correct = questionData.correct,
                explanation = questionData.explanation,
                difficulty = QuizDifficulty.valueOf(questionData.difficulty.uppercase()),
                tags = questionData.tags
            )
            
            quizQuestionRepository.save(question)
        }
        
        logger.info("Generated and saved ${savedQuestions.size} new questions for $sport $position")
        return savedQuestions
    }
    
    private fun callClaudeForQuizGeneration(
        sport: String, 
        position: String, 
        categories: List<QuizCategory>,
        existingQuestions: List<QuizQuestion>
    ): List<GeneratedQuestionData> {
        
        val systemPrompt = buildSystemPrompt(sport, position, categories, existingQuestions)
        
        val requestBody = mapOf(
            "model" to "claude-sonnet-4-20250514",
            "max_tokens" to 4000,
            "messages" to listOf(
                mapOf(
                    "role" to "user",
                    "content" to "Generate exactly 15 new quiz questions for $sport $position training. Return only valid JSON array with no markdown formatting."
                )
            ),
            "system" to systemPrompt
        )
        
        val headers = HttpHeaders().apply {
            contentType = MediaType.APPLICATION_JSON
            set("x-api-key", claudeApiKey)
            set("anthropic-version", "2023-06-01")
        }
        
        try {
            val response = restTemplate.exchange(
                claudeApiUrl,
                HttpMethod.POST,
                HttpEntity(requestBody, headers),
                String::class.java
            )
            
            val responseBody = response.body ?: throw RuntimeException("Empty response from Claude API")
            val claudeResponse = objectMapper.readValue(responseBody, ClaudeResponse::class.java)
            
            // Extract JSON content from Claude's response
            val content = claudeResponse.content.firstOrNull()?.text 
                ?: throw RuntimeException("No content in Claude response")
            
            // Parse the generated questions JSON
            val questionsJson = extractJsonFromResponse(content)
            return objectMapper.readValue(questionsJson, Array<GeneratedQuestionData>::class.java).toList()
            
        } catch (e: Exception) {
            logger.error("Failed to generate questions using Claude API", e)
            throw RuntimeException("Quiz generation failed: ${e.message}", e)
        }
    }
    
    private fun buildSystemPrompt(
        sport: String,
        position: String, 
        categories: List<QuizCategory>,
        existingQuestions: List<QuizQuestion>
    ): String {
        val categoryDescriptions = categories.joinToString("\n") { 
            "- ${it.categoryName}: ${it.description}" 
        }
        
        val existingScenarios = existingQuestions.take(5).joinToString("\n") { 
            "Example: ${it.scenario}"
        }
        
        return """
You are an expert $sport coach specializing in $position training. Generate exactly 15 new quiz questions that test game situations, decision-making, and tactical awareness.

SPORT: $sport
POSITION: $position

AVAILABLE CATEGORIES:
$categoryDescriptions

EXISTING QUESTION EXAMPLES (DO NOT DUPLICATE):
$existingScenarios

REQUIREMENTS:
1. Generate exactly 15 questions
2. Focus on situational decision-making and game IQ
3. Each question must have exactly 4 multiple choice options (A, B, C, D)
4. Include realistic game scenarios specific to $position
5. Vary difficulty levels (beginner, intermediate, advanced)
6. DO NOT duplicate any existing scenarios or situations
7. Include tactical awareness, opponent analysis, and strategic thinking

RESPONSE FORMAT - Return ONLY this JSON array with no markdown formatting:
[
  {
    "id": "unique_id_1",
    "categoryHint": "category_name",
    "scenario": "Detailed game situation...",
    "question": "What should you do in this situation?",
    "options": [
      {"id": "A", "text": "Option A"},
      {"id": "B", "text": "Option B"},
      {"id": "C", "text": "Option C"},
      {"id": "D", "text": "Option D"}
    ],
    "correct": "B",
    "explanation": "Detailed explanation of why this is correct...",
    "difficulty": "intermediate",
    "tags": ["tag1", "tag2", "tag3"]
  }
]
        """.trimIndent()
    }
    
    private fun extractJsonFromResponse(content: String): String {
        // Remove any markdown formatting and extract JSON
        val jsonStart = content.indexOf('[')
        val jsonEnd = content.lastIndexOf(']') + 1
        
        if (jsonStart == -1 || jsonEnd <= jsonStart) {
            throw RuntimeException("No valid JSON array found in Claude response")
        }
        
        return content.substring(jsonStart, jsonEnd)
    }
    
    private fun findOrCreateGeneratedCategory(sport: String, position: String, categoryHint: String?): QuizCategory {
        // Try to find existing category that matches the hint
        if (categoryHint != null) {
            val existingCategory = quizCategoryRepository
                .findBySportAndPositionAndCategoryName(sport, position, categoryHint)
            if (existingCategory != null) {
                return existingCategory
            }
        }
        
        // Create or find a "Generated" category
        val generatedCategoryName = "generated-scenarios"
        return quizCategoryRepository
            .findBySportAndPositionAndCategoryName(sport, position, generatedCategoryName)
            ?: quizCategoryRepository.save(
                QuizCategory(
                    sport = sport,
                    position = position,
                    categoryName = generatedCategoryName,
                    description = "AI-generated situational scenarios and decision-making questions"
                )
            )
    }
}

// Data classes for Claude API integration
data class ClaudeResponse(
    val content: List<ClaudeContent>
)

data class ClaudeContent(
    val text: String,
    val type: String
)

data class GeneratedQuestionData(
    val id: String,
    val categoryHint: String?,
    val scenario: String,
    val question: String,
    val options: List<GeneratedOptionData>,
    val correct: String,
    val explanation: String,
    val difficulty: String,
    val tags: List<String>
)

data class GeneratedOptionData(
    val id: String,
    val text: String
)