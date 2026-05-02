package com.gameiq.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.gameiq.entity.*
import com.gameiq.repository.QuizCategoryRepository
import com.gameiq.repository.QuizQuestionRepository
import jakarta.annotation.PostConstruct
import org.slf4j.LoggerFactory
import org.springframework.core.io.ResourceLoader
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.io.IOException

@Service
class QuizDataImportService(
    private val quizCategoryRepository: QuizCategoryRepository,
    private val quizQuestionRepository: QuizQuestionRepository,
    private val resourceLoader: ResourceLoader,
    private val objectMapper: ObjectMapper
) {
    private val logger = LoggerFactory.getLogger(QuizDataImportService::class.java)

    @PostConstruct
    fun initializeQuizData() {
        logger.info("Starting quiz data import from JSON files...")
        importAllQuizData()
        logger.info("Quiz data import completed successfully")
    }

    @Transactional
    fun importAllQuizData() {
        val staticResourcePath = "classpath:/static/"
        
        // Get all JSON files that match the naming convention: sport__position_core.json
        val quizFiles = getQuizFiles(staticResourcePath)
        
        quizFiles.forEach { fileName ->
            try {
                val (sport, position) = parseFileName(fileName)
                importQuizFile(fileName, sport, position)
                logger.info("Successfully imported quiz data for $sport $position")
            } catch (e: Exception) {
                logger.error("Failed to import quiz file $fileName", e)
                // Continue with other files rather than failing completely
            }
        }
    }

    private fun getQuizFiles(basePath: String): List<String> {
        // In a production environment, you might want to scan the directory
        // For now, we'll define the known files based on your naming convention
        return listOf(
            "basketball__point-guard_core.json",
            "football__quarterback_core.json",
            "baseball__pitcher_core.json",
            "soccer__midfielder_core.json"
            // Add more as you create them
        ).filter { fileName ->
            try {
                val resource = resourceLoader.getResource("$basePath$fileName")
                resource.exists()
            } catch (e: Exception) {
                logger.warn("Quiz file $fileName not found, skipping...")
                false
            }
        }
    }

    private fun parseFileName(fileName: String): Pair<String, String> {
        // Parse: "basketball__point-guard_core.json" -> ("basketball", "point-guard")
        val nameWithoutExtension = fileName.removeSuffix("_core.json")
        val parts = nameWithoutExtension.split("__")
        
        if (parts.size != 2) {
            throw IllegalArgumentException("Invalid file name format: $fileName. Expected: sport__position_core.json")
        }
        
        return Pair(parts[0], parts[1])
    }

    @Transactional
    fun importQuizFile(fileName: String, sport: String, position: String) {
        try {
            val resource = resourceLoader.getResource("classpath:/static/$fileName")
            val quizData = objectMapper.readValue(resource.inputStream, QuizFileData::class.java)
            
            // Validate that the file data matches the filename
            if (quizData.sport != sport || quizData.position != position) {
                logger.warn("File $fileName contains data for ${quizData.sport}/${quizData.position} but filename suggests $sport/$position")
            }
            
            // Import categories and questions
            quizData.categories.forEach { (categoryName, categoryData) ->
                importQuizCategory(quizData.sport, quizData.position, categoryName, categoryData)
            }
            
        } catch (e: IOException) {
            throw RuntimeException("Failed to read quiz file: $fileName", e)
        }
    }

    private fun importQuizCategory(sport: String, position: String, categoryName: String, categoryData: CategoryData) {
        // Find or create the category
        var category = quizCategoryRepository.findBySportAndPositionAndCategoryName(sport, position, categoryName)
        
        if (category == null) {
            category = QuizCategory(
                sport = sport,
                position = position,
                categoryName = categoryName,
                description = categoryData.description
            )
            category = quizCategoryRepository.save(category)
            logger.debug("Created new category: $sport/$position/$categoryName")
        } else {
            logger.debug("Using existing category: $sport/$position/$categoryName")
        }
        
        // Import questions for this category
        categoryData.questions.forEach { questionData ->
            importQuestion(category, questionData)
        }
    }

    private fun importQuestion(category: QuizCategory, questionData: QuestionData) {
        // Check if question already exists
        val existingQuestion = quizQuestionRepository.findByCategoryAndQuestionId(category, questionData.id)
        
        if (existingQuestion == null) {
            val question = QuizQuestion(
                category = category,
                questionId = questionData.id,
                scenario = questionData.scenario,
                question = questionData.question,
                options = questionData.options.map { QuizOption(it.id, it.text) },
                correct = questionData.correct,
                explanation = questionData.explanation,
                difficulty = QuizDifficulty.valueOf(questionData.difficulty.uppercase()),
                tags = questionData.tags
            )
            
            quizQuestionRepository.save(question)
            logger.debug("Imported question: ${questionData.id}")
        } else {
            logger.debug("Question ${questionData.id} already exists, skipping...")
        }
    }

    // Method to re-import data (useful for updates)
    @Transactional
    fun reimportQuizData() {
        logger.info("Re-importing quiz data (will update existing questions)...")
        // Note: This doesn't delete existing data, just updates it
        importAllQuizData()
    }
}

// Data classes for JSON parsing
data class QuizFileData(
    val position: String,
    val sport: String,
    val categories: Map<String, CategoryData>
)

data class CategoryData(
    val description: String,
    val questions: List<QuestionData>
)

data class QuestionData(
    val id: String,
    val scenario: String,
    val question: String,
    val options: List<OptionData>,
    val correct: String,
    val explanation: String,
    val difficulty: String,
    val tags: List<String>
)

data class OptionData(
    val id: String,
    val text: String
)