package com.gameiq.controller

import com.gameiq.entity.*
import com.gameiq.service.*
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.slf4j.LoggerFactory

data class WorkoutTitleUpdateRequest(val title: String)

@RestController
@RequestMapping("/workouts")
class WorkoutController @Autowired constructor(
    private val claudeService: ClaudeService,
    private val workoutService: WorkoutService
) {

    private val logger = LoggerFactory.getLogger(WorkoutController::class.java)
    private val objectMapper: ObjectMapper = jacksonObjectMapper()

    @GetMapping("/test")
    fun testWorkouts(): ResponseEntity<Map<String, Any>> {
        return ResponseEntity.ok(mapOf(
            "message" to "Workout controller is working",
            "availableSports" to listOf("FOOTBALL", "BASKETBALL", "BASEBALL", "SOCCER"),
            "availablePositions" to listOf("QB", "PG", "PITCHER", "GOALKEEPER")
        ))
    }

    @PostMapping("/generate")
    fun generateWorkout(
        @RequestBody request: WorkoutGenerationRequest
    ): ResponseEntity<WorkoutPlanDTO> {
        return try {
            val workoutPlan = claudeService.generateWorkoutPlan(
                userId = request.userId,
                sport = request.sport,
                position = request.position,
                experienceLevel = request.experienceLevel,
                trainingPhase = request.trainingPhase,
                availableEquipment = request.availableEquipment.joinToString(", "),
                sessionDuration = request.sessionDuration,
                focusAreas = request.focusAreas.joinToString(", "),
                specialRequirements = request.specialRequirements,
                additionalEquipment = request.additionalEquipment,
                specialFocusAreas = request.specialFocusAreas,
                fitnessGoals = request.fitnessGoals
            )

            val exercises = parseExercisesFromGeneratedContent(workoutPlan.generatedContent)

            val workoutPlanDTO = WorkoutPlanDTO(
                id = workoutPlan.id.toString(),
                title = workoutPlan.workoutName
                    ?: "${request.position ?: ""} ${request.trainingPhase} Workout".trim(),
                description = workoutPlan.positionFocus ?: "",
                estimatedDuration = workoutPlan.durationMinutes ?: request.sessionDuration,
                exercises = exercises,
                focusAreas = request.focusAreas.ifEmpty {
                    try {
                        val tree = objectMapper.readTree(workoutPlan.generatedContent)
                        val focusStr = tree.get("focusAreas")?.asText() ?: ""
                        if (focusStr.isNotBlank()) focusStr.split(",").map { it.trim() }.filter { it.isNotBlank() }
                        else listOf("General Training")
                    } catch (e: Exception) {
                        listOf("General Training")
                    }
                },
                createdAt = workoutPlan.createdAt.toString(),
                sport = request.sport,
                position = request.position ?: "",
                generatedContent = workoutPlan.generatedContent,
                displayTitle = workoutPlan.displayTitle
            )

            ResponseEntity.ok(workoutPlanDTO)

        } catch (e: IllegalStateException) {
            // Trial/subscription limit errors — return message so frontend can show paywall
            logger.warn("Subscription limit for userId=${request.userId}: ${e.message}")
            ResponseEntity.badRequest().body(
                WorkoutPlanDTO(
                    id = "",
                    title = "",
                    description = e.message ?: "Subscription limit reached.",
                    estimatedDuration = 0,
                    exercises = emptyList(),
                    focusAreas = emptyList(),
                    createdAt = "",
                    sport = "",
                    position = "",
                    generatedContent = null
                )
            )
        } catch (e: Exception) {
            logger.error("Failed to generate workout for userId=${request.userId}: ${e.message}", e)
            ResponseEntity.badRequest().body(
                WorkoutPlanDTO(
                    id = "",
                    title = "",
                    description = e.message ?: "Failed to generate workout.",
                    estimatedDuration = 0,
                    exercises = emptyList(),
                    focusAreas = emptyList(),
                    createdAt = "",
                    sport = "",
                    position = "",
                    generatedContent = null
                )
            )
        }
    }

    @GetMapping("/user/{userId}")
    fun getUserWorkouts(@PathVariable userId: Long): ResponseEntity<List<WorkoutPlanDTO>> {
        return try {
            val workoutPlans = workoutService.getUserWorkoutPlans(userId)

            val workoutDTOs = workoutPlans.map { workoutPlan ->
                WorkoutPlanDTO(
                    id = workoutPlan.id.toString(),
                    title = workoutPlan.workoutName ?: "Workout Plan",
                    description = workoutPlan.positionFocus ?: "",
                    estimatedDuration = workoutPlan.durationMinutes ?: 45,
                    exercises = emptyList(),
                    focusAreas = listOf(workoutPlan.positionFocus ?: "General Training"),
                    createdAt = workoutPlan.createdAt.toString(),
                    sport = workoutPlan.sport.name,
                    position = workoutPlan.position?.name ?: "",
                    generatedContent = workoutPlan.generatedContent,
                    displayTitle = workoutPlan.displayTitle
                )
            }

            ResponseEntity.ok(workoutDTOs)
        } catch (e: Exception) {
            logger.error("Failed to get workouts for userId=$userId: ${e.message}", e)
            ResponseEntity.badRequest().build()
        }
    }

    @GetMapping("/{workoutId}")
    fun getWorkoutById(@PathVariable workoutId: Long): ResponseEntity<WorkoutPlan?> {
        val workout = workoutService.getWorkoutPlanById(workoutId)
        return ResponseEntity.ok(workout)
    }

    @PutMapping("/{workoutId}/title")
    fun updateWorkoutTitle(
        @PathVariable workoutId: Long,
        @RequestBody request: WorkoutTitleUpdateRequest
    ): ResponseEntity<WorkoutPlanDTO> {
        val updated = workoutService.updateDisplayTitle(workoutId, request.title)
            ?: return ResponseEntity.notFound().build()

        val exercises = parseExercisesFromGeneratedContent(updated.generatedContent)

        val dto = WorkoutPlanDTO(
            id = updated.id.toString(),
            title = updated.workoutName ?: "Workout Plan",
            description = updated.positionFocus ?: "",
            estimatedDuration = updated.durationMinutes ?: 45,
            exercises = exercises,
            focusAreas = listOf(updated.positionFocus ?: "General Training"),
            createdAt = updated.createdAt.toString(),
            sport = updated.sport.name,
            position = updated.position?.name ?: "",
            generatedContent = updated.generatedContent,
            displayTitle = updated.displayTitle
        )
        return ResponseEntity.ok(dto)
    }

    @PutMapping("/{workoutId}/exercises/video")
    fun updateExerciseVideo(
        @PathVariable workoutId: Long,
        @RequestBody request: UpdateExerciseVideoRequest
    ): ResponseEntity<Any> {
        return try {
            val updatedWorkout = workoutService.updateExerciseVideo(
                workoutId = workoutId,
                exerciseName = request.exerciseName,
                videoId = request.videoId,
                videoUrl = request.videoUrl,
                videoTitle = request.videoTitle
            )

            if (updatedWorkout != null) {
                ResponseEntity.ok(mapOf("message" to "Exercise video updated successfully"))
            } else {
                ResponseEntity.notFound().build()
            }
        } catch (e: Exception) {
            logger.error("Failed to update exercise video for workoutId=$workoutId: ${e.message}", e)
            ResponseEntity.badRequest().build()
        }
    }

    private fun parseExercisesFromGeneratedContent(generatedContent: String?): List<ExerciseDTO> {
        if (generatedContent.isNullOrEmpty()) {
            logger.warn("parseExercises: generatedContent is null or empty")
            return emptyList()
        }

        logger.info("parseExercises: raw content (first 500 chars): ${generatedContent.take(500)}")

        return try {
            val workoutData = objectMapper.readTree(generatedContent)
            val hasExercises = workoutData.has("exercises")
            val hasMainExercises = workoutData.has("mainExercises")
            logger.info("parseExercises: JSON parsed successfully. has 'exercises': $hasExercises, has 'mainExercises': $hasMainExercises")
            logger.info("parseExercises: top-level keys: ${workoutData.fieldNames().asSequence().toList()}")

            val exercisesNode = workoutData.get("exercises") ?: workoutData.get("mainExercises")

            if (exercisesNode?.isArray == true) {
                logger.info("parseExercises: found ${exercisesNode.size()} exercises in JSON array")
                exercisesNode.map { exerciseNode ->
                    ExerciseDTO(
                        name = exerciseNode.get("name")?.asText() ?: "Exercise",
                        description = exerciseNode.get("description")?.asText() ?: "",
                        sets = exerciseNode.get("sets")?.asInt() ?: 3,
                        reps = exerciseNode.get("reps")?.asText() ?: "8-12",
                        duration = exerciseNode.get("duration")?.asText(),
                        restPeriod = exerciseNode.get("restSeconds")?.asInt()?.let { "${it} seconds" },
                        instructions = exerciseNode.get("instructions")?.map { it.asText() },
                        videoUrl = exerciseNode.get("videoUrl")?.asText(),
                        positionBenefit = exerciseNode.get("positionBenefit")?.asText(),
                        gameApplication = exerciseNode.get("gameApplication")?.asText(),
                        injuryPrevention = exerciseNode.get("injuryPrevention")?.asText(),
                        coachingCue = exerciseNode.get("coachingCue")?.asText()
                    )
                }
            } else {
                logger.warn("parseExercises: exercisesNode is null or not an array (isArray=${exercisesNode?.isArray}, nodeType=${exercisesNode?.nodeType}), falling back to markdown parser")
                parseExercisesFromMarkdown(generatedContent)
            }
        } catch (e: Exception) {
            logger.warn("parseExercises: JSON parsing failed with ${e.javaClass.simpleName}: ${e.message}, falling back to markdown parser")
            parseExercisesFromMarkdown(generatedContent)
        }
    }

    data class UpdateExerciseVideoRequest(
        val exerciseName: String,
        val videoId: String,
        val videoUrl: String,
        val videoTitle: String? = null
    )

    private fun parseExercisesFromMarkdown(content: String): List<ExerciseDTO> {
        logger.info("parseExercisesFromMarkdown: attempting markdown parse on content (first 500 chars): ${content.take(500)}")
        val exercises = mutableListOf<ExerciseDTO>()

        try {
            val exercisePattern = Regex("""\*\*(\d+\.\s+.*?)\*\*""")
            val matches = exercisePattern.findAll(content)
            val matchCount = matches.count()
            logger.info("parseExercisesFromMarkdown: regex '\\*\\*(\\d+\\.\\s+.*?)\\*\\*' found $matchCount matches")

            // Re-run findAll since .count() consumed the sequence
            exercisePattern.findAll(content).forEach { match ->
                val exerciseText = match.groupValues[1]
                val name = exerciseText.split("**").firstOrNull()?.trim() ?: "Exercise"
                logger.info("parseExercisesFromMarkdown: matched exercise: '$name'")

                val setsPattern = Regex("""Sets:\s*(\d+)""", RegexOption.IGNORE_CASE)
                val repsPattern = Regex("""Reps:\s*([^|]+)""", RegexOption.IGNORE_CASE)
                val restPattern = Regex("""Rest:\s*([^|]+)""", RegexOption.IGNORE_CASE)

                val sets = setsPattern.find(content)?.groupValues?.get(1)?.toIntOrNull() ?: 3
                val reps = repsPattern.find(content)?.groupValues?.get(1)?.trim() ?: "8-12"
                val rest = restPattern.find(content)?.groupValues?.get(1)?.trim()

                exercises.add(ExerciseDTO(
                    name = name,
                    description = "Position-specific exercise",
                    sets = sets,
                    reps = reps,
                    restPeriod = rest,
                    instructions = null,
                    videoUrl = null
                ))
            }
        } catch (e: Exception) {
            logger.error("parseExercisesFromMarkdown: exception during markdown parsing: ${e.javaClass.simpleName}: ${e.message}", e)
            exercises.add(ExerciseDTO(
                name = "AI-Generated Workout",
                description = "Complete workout available in enhanced content",
                sets = 3,
                reps = "As prescribed",
                instructions = listOf("Follow the detailed workout instructions provided by Claude AI")
            ))
        }

        logger.info("parseExercisesFromMarkdown: returning ${exercises.size} exercises")
        return exercises
    }
}