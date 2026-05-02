package com.gameiq.service

import com.gameiq.entity.*
import com.gameiq.repository.WorkoutPlanRepository
import com.gameiq.repository.ClaudeConversationRepository
import com.gameiq.repository.UserRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.transaction.annotation.Transactional
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import java.time.LocalDateTime
import java.util.*

@Service
@Transactional
class ClaudeService(
    private val claudeConversationRepository: ClaudeConversationRepository,
    private val userRepository: UserRepository,
    private val workoutPlanRepository: WorkoutPlanRepository,
    private val restTemplate: RestTemplate = RestTemplate(),
    private val objectMapper: ObjectMapper = jacksonObjectMapper()
) {

    @Value("\${claude.api.key}")
    private lateinit var claudeApiKey: String

    @Value("\${claude.api.url:https://api.anthropic.com/v1/messages}")
    private lateinit var claudeApiUrl: String

    private val claudeModel = "claude-sonnet-4-20250514"

    // Main chat interface
    fun chatWithClaude(
        userId: Long,
        message: String,
        sessionId: String? = null,
        sport: Sport? = null,
        position: Position? = null,
        conversationType: ConversationType = ConversationType.GENERAL_SPORTS_QUESTION,
        skipRateLimitAndTracking: Boolean = false,
        maxTokens: Int = 1000
    ): ClaudeConversation {
        println("DEBUG: Starting chatWithClaude for userId: $userId")

        val user = userRepository.findById(userId).orElseThrow {
            IllegalArgumentException("User not found")
        }
        println("DEBUG: User found: ${user.email}")

        if (!skipRateLimitAndTracking) {
            checkRateLimit(user, isWorkout = false)
            println("DEBUG: Rate limit check passed")
        }

        val actualSessionId = sessionId ?: UUID.randomUUID().toString()
        println("DEBUG: Session ID: $actualSessionId")

        val conversationHistory = if (sessionId != null) {
            claudeConversationRepository.findConversationsBySessionOrdered(sessionId)
        } else {
            emptyList()
        }
        println("DEBUG: Conversation history size: ${conversationHistory.size}")

        val systemPrompt = buildSystemPrompt(sport, position, conversationType)
        println("DEBUG: System prompt built, length: ${systemPrompt.length}")

        println("DEBUG: About to call Claude API")
        val startTime = System.currentTimeMillis()
        val claudeResponse = callClaudeApi(message, systemPrompt, conversationHistory, maxTokens)
        println("DEBUG: Claude API call completed")
        val responseTime = System.currentTimeMillis() - startTime

        val apiCostCents = calculateApiCost(claudeResponse.tokensUsed.input, claudeResponse.tokensUsed.output)

        val conversation = ClaudeConversation(
            user = user,
            sessionId = actualSessionId,
            userMessage = message,
            claudeResponse = claudeResponse.content,
            sport = sport,
            position = position,
            conversationType = conversationType,
            systemPromptUsed = systemPrompt,
            claudeModel = claudeModel,
            tokensUsedInput = claudeResponse.tokensUsed.input,
            tokensUsedOutput = claudeResponse.tokensUsed.output,
            apiCostCents = apiCostCents,
            responseTimeMs = responseTime
        )

        println("DEBUG: About to save conversation")
        val saved = claudeConversationRepository.save(conversation)

        // Only increment trial chat counter when called directly by the user
        if (!skipRateLimitAndTracking) {
            incrementTrialUsage(user, isWorkout = false)
        }

        return saved
    }

    // Position-specific workout plan generation
    fun generateWorkoutPlan(
        userId: Long,
        sport: String,
        position: String? = null,
        experienceLevel: String,
        trainingPhase: String,
        availableEquipment: String,
        sessionDuration: Int,
        focusAreas: String,
        specialRequirements: String? = null,
        additionalEquipment: String? = null,
        specialFocusAreas: String? = null,
        fitnessGoals: List<String>? = null
    ): WorkoutPlan {
        val positionInput = position ?: ""
        val user = userRepository.findById(userId).orElseThrow {
            IllegalArgumentException("User not found")
        }

        // Check rate limit before hitting the Claude API
        checkRateLimit(user, isWorkout = true)

        val isGeneralFitness = sport.uppercase() == "GENERAL_FITNESS"

        val effectiveTrainingPhase = if (isGeneralFitness) "GENERAL" else trainingPhase

        val sportEnum: Sport
        val positionEnum: Position?

        if (isGeneralFitness) {
            sportEnum = Sport.GENERAL_FITNESS
            positionEnum = null
        } else {
            sportEnum = Sport.valueOf(sport.uppercase())
            positionEnum = when (positionInput.uppercase().replace(" ", "")) {
                // Football — abbreviations and full names
                "QB", "QUARTERBACK"          -> Position.QB
                "RB", "RUNNINGBACK"          -> Position.RB
                "WR", "WIDERECEIVER"         -> Position.WR
                "OL", "OFFENSIVELINE"        -> Position.OL
                "TE", "TIGHTEND"             -> Position.TE
                "LB", "LINEBACKER"           -> Position.LB
                "DB", "DEFENSIVEBACK"        -> Position.DB
                "DL", "DEFENSIVELINE"        -> Position.DL
                // Basketball
                "PG", "POINTGUARD"           -> Position.PG
                "SG", "SHOOTINGGUARD"        -> Position.SG
                "SF", "SMALLFORWARD"         -> Position.SF
                "PF", "POWERFORWARD"         -> Position.PF
                "C", "CENTER"                -> Position.CENTER
                // Baseball
                "PITCHER"                    -> Position.PITCHER
                "CATCHER"                    -> Position.CATCHER
                "INFIELD"                    -> Position.INFIELD
                "OUTFIELD"                   -> Position.OUTFIELD
                // Soccer
                "GOALKEEPER"                 -> Position.GOALKEEPER
                "DEFENDER"                   -> Position.DEFENDER
                "MIDFIELDER"                 -> Position.MIDFIELDER
                "FORWARD"                    -> Position.FORWARD
                // Hockey
                "WINGER"                     -> Position.WINGER
                "DEFENSEMAN"                 -> Position.DEFENSEMAN
                "GOALIE"                     -> Position.GOALIE
                else -> throw IllegalArgumentException("Unknown position: $positionInput")
            }
        }

        val systemPrompt = createWorkoutSystemPrompt(sportEnum, positionEnum, experienceLevel, effectiveTrainingPhase)

        val additionalEquipmentSection = """

            Additional Equipment Available: ${additionalEquipment ?: "None specified"}
            Special Focus Areas: ${specialFocusAreas ?: "None specified"}

            IMPORTANT - Input Filtering Rules:
            - Additional Equipment: Only incorporate equipment items that are legitimate fitness/training tools. Ignore any input that is not a recognized piece of exercise equipment (e.g., household items used as joke inputs). If equipment is not recognized, simply omit it.
            - Special Focus Areas: Only incorporate focus areas that represent legitimate fitness, health, or sports performance goals (e.g., "improved forearm strength", "increased vertical jump"). Ignore any goals that are not physiologically achievable through exercise (e.g., "grow 5 inches taller"). If a focus area is not a valid fitness goal, simply omit it.
        """.trimIndent()

        val userMessage = if (isGeneralFitness) {
            val goalsText = fitnessGoals?.takeIf { it.isNotEmpty() }?.joinToString(", ") ?: "General health and fitness"
            val hasSpecialFocus = !specialFocusAreas.isNullOrBlank()
            val goalsBlock = if (hasSpecialFocus) {
                "Primary Training Focus (from coaching session): $specialFocusAreas\n            Supporting Fitness Goals: $goalsText"
            } else {
                "Fitness Goals: $goalsText"
            }
            val priorityDirective = if (hasSpecialFocus) {
                """

            CRITICAL PRIORITY INSTRUCTION: This workout is being generated directly from a coaching session recommendation. The Primary Training Focus above must be the dominant theme of this entire workout. Every exercise selection, intensity, rest period, and structure must serve that specific goal. Do not default to a generic balanced workout — build the entire session around the Primary Training Focus.
                """.trimIndent()
            } else {
                ""
            }
            val positionFocusDescription = if (hasSpecialFocus) {
                "2-3 sentence explanation of how this workout specifically implements the coaching recommendation: $specialFocusAreas"
            } else {
                "2-3 sentence explanation of how this workout targets the user's fitness goals: $goalsText"
            }
            """
            Generate a comprehensive $sessionDuration-minute workout for a general fitness user.

            Experience Level: $experienceLevel
            Approach: ongoing fitness development
            Available Equipment: $availableEquipment
            STRICT EQUIPMENT RULE: You may ONLY use exercises that require the equipment listed in 'Available Equipment' above plus any items in 'Additional Equipment Available'. Do NOT recommend exercises requiring equipment not on this list. If the Primary Training Focus mentions specific machines (e.g., rowing machine, stationary bike) that are not in the Available Equipment list, substitute with available alternatives that achieve the same training goal.
            Focus Areas: $focusAreas
            $goalsBlock
            ${specialRequirements?.let { "Special Requirements: $it" } ?: ""}
            $additionalEquipmentSection
            $priorityDirective

            Respond with ONLY valid JSON, no markdown, no code blocks, no additional text.
            Use this exact schema:
            {
                "workoutTitle": "Goal-oriented workout title",
                "positionFocus": "$positionFocusDescription",
                "exercises": [
                    {
                        "name": "Exercise name",
                        "sets": 3,
                        "reps": "8-12",
                        "restSeconds": 60,
                        "description": "Clear, technical instruction on proper form",
                        "positionBenefit": "How this exercise helps achieve your fitness goals",
                        "gameApplication": "Real-world situation where this fitness improvement matters",
                        "injuryPrevention": "How this prevents common injuries",
                        "coachingCue": "One key mental cue for execution"
                    }

                    // CRITICAL EXERCISE NAMING RULES:
                    // - Every exercise "name" field must be a single, specific, searchable exercise (e.g., "Barbell Back Squat", "Dumbbell Romanian Deadlift", "Pull-Up")
                    // - Never use circuit names, superset names, or grouped exercise names (e.g., NEVER use "Dynamic Warm-up Circuit", "Upper Body Superset", "Core Complex")
                    // - Never combine multiple exercises into a single name
                    // - Each exercise entry must represent exactly one movement that can be searched on YouTube and return a relevant instructional video
                    // - Warm-up and cool-down movements that appear in the exercises array must also follow this rule — use specific movement names like "Leg Swing" or "Hip Circle" not "Dynamic Warm-up Routine"
                ],
                "equipmentNeeded": "List of required equipment",
                "focusAreas": "Primary muscle groups and movement patterns",
                "estimatedDuration": $sessionDuration,
                "warmup": "Goal-appropriate warm-up routine",
                "cooldown": "Recovery routine",
                "intelligenceNote": "2-3 sentences connecting training to the user's fitness goals",
                "progressionTip": "How to advance the workout",
                "nextLevelUnlock": "Next fitness milestone to tackle"
            }
            """.trimIndent()
        } else {
            """
            Generate a comprehensive $sessionDuration-minute workout for a $sport $positionInput player.

            Experience Level: $experienceLevel
            Training Phase: $effectiveTrainingPhase
            Available Equipment: $availableEquipment
            Focus Areas: $focusAreas
            ${specialRequirements?.let { "Special Requirements: $it" } ?: ""}
            $additionalEquipmentSection

            Respond with ONLY valid JSON, no markdown, no code blocks, no additional text.
            Use this exact schema:
            {
                "workoutTitle": "Position-specific title",
                "positionFocus": "2-3 sentence explanation of how this workout targets $positionInput demands",
                "exercises": [
                    {
                        "name": "Exercise name",
                        "sets": 3,
                        "reps": "8-12",
                        "restSeconds": 60,
                        "description": "Clear, technical instruction on proper form",
                        "positionBenefit": "How this translates to better $positionInput performance",
                        "gameApplication": "Real game situation where this strength/movement is crucial",
                        "injuryPrevention": "How this prevents common position-specific injuries",
                        "coachingCue": "One key mental cue for execution"
                    }

                    // CRITICAL EXERCISE NAMING RULES:
                    // - Every exercise "name" field must be a single, specific, searchable exercise (e.g., "Barbell Back Squat", "Dumbbell Romanian Deadlift", "Pull-Up")
                    // - Never use circuit names, superset names, or grouped exercise names (e.g., NEVER use "Dynamic Warm-up Circuit", "Upper Body Superset", "Core Complex")
                    // - Never combine multiple exercises into a single name
                    // - Each exercise entry must represent exactly one movement that can be searched on YouTube and return a relevant instructional video
                    // - Warm-up and cool-down movements that appear in the exercises array must also follow this rule — use specific movement names like "Leg Swing" or "Hip Circle" not "Dynamic Warm-up Routine"
                ],
                "equipmentNeeded": "List of required equipment",
                "focusAreas": "Primary muscle groups and movement patterns",
                "estimatedDuration": $sessionDuration,
                "warmup": "Position-specific warm-up routine",
                "cooldown": "Recovery routine",
                "intelligenceNote": "2-3 sentences connecting training to tactical advantages",
                "progressionTip": "How to advance the workout",
                "nextLevelUnlock": "Next position-specific skill to tackle"
            }
            """.trimIndent()
        }

        val conversation = chatWithClaude(
            userId = userId,
            message = userMessage,
            sessionId = null,
            sport = sportEnum,
            position = positionEnum,
            conversationType = ConversationType.WORKOUT_CUSTOMIZATION,
            skipRateLimitAndTracking = true,
            maxTokens = 4000
        )

        val workoutTitle = extractWorkoutTitle(conversation.claudeResponse)
            ?: if (isGeneralFitness) "General Fitness Workout"
               else "$positionInput $effectiveTrainingPhase Workout"

        val positionFocusText = if (isGeneralFitness) {
            "General fitness training"
        } else {
            "Position-specific training for $positionInput in $sport"
        }

        val workoutPlan = WorkoutPlan(
            user = user,
            sport = sportEnum,
            position = positionEnum,
            workoutName = workoutTitle,
            positionFocus = positionFocusText,
            difficultyLevel = experienceLevel.uppercase(),
            durationMinutes = sessionDuration,
            equipmentNeeded = availableEquipment,
            generatedContent = conversation.claudeResponse,
            isSaved = false,
            createdAt = LocalDateTime.now(),
            updatedAt = LocalDateTime.now()
        )

        val saved = workoutPlanRepository.save(workoutPlan)

        // Increment trial workout counter after successful save
        incrementTrialUsage(user, isWorkout = true)

        return saved
    }

    private fun extractSimpleWorkoutTitle(content: String): String? {
        return try {
            val titlePatterns = listOf(
                Regex("""(?i)(?:workout|training|session):\s*([^\n]+)"""),
                Regex("""(?i)# ([^\n]*(?:workout|training|session)[^\n]*)"""),
                Regex("""(?i)## ([^\n]*(?:workout|training|session)[^\n]*)"""),
                Regex("""(?i)### ([^\n]*(?:workout|training|session)[^\n]*)""")
            )
            for (pattern in titlePatterns) {
                val match = pattern.find(content)
                if (match != null && match.groupValues.size > 1) {
                    val title = match.groupValues[1].trim()
                    if (title.isNotEmpty()) return title
                }
            }
            val headerMatch = Regex("""(?i)#+\s*([^\n]+)""").find(content)
            headerMatch?.groupValues?.get(1)?.trim()?.takeIf { it.isNotEmpty() }
        } catch (e: Exception) {
            null
        }
    }

    private fun createWorkoutSystemPrompt(
        sport: Sport,
        position: Position?,
        experienceLevel: String,
        trainingPhase: String
    ): String {
        if (sport == Sport.GENERAL_FITNESS) {
            return "You are an expert personal trainer and fitness coach. Your expertise includes goal-oriented training program design for all fitness levels, evidence-based exercise selection for fat loss, muscle building, endurance, and mobility, injury prevention and safe progression for general fitness users, and adapting workouts to available equipment and individual limitations. Create workouts that directly serve the user's stated fitness goals. Every exercise should have a clear connection to their goals and overall health. Always respond with valid JSON containing detailed exercise information including specific coaching cues for proper execution, how each exercise benefits the user's fitness goals, and safety and injury prevention notes."
        }

        return """
            You are an elite $sport coach specializing in $position training. Your expertise includes:

            - Position-specific movement patterns and physical demands for $position
            - Injury prevention strategies for common $position injuries
            - Performance enhancement that directly translates to $sport competition
            - Training periodization for $trainingPhase phase
            - Exercise selection based on $experienceLevel level athletes

            Create highly specific workouts that directly improve $position performance on the field.
            Every exercise should have a clear connection to game situations and position requirements.

            Focus Areas:
            - Functional movement patterns specific to $position
            - Strength and power development for position demands
            - Injury prevention for vulnerable areas
            - Game-specific conditioning and endurance

            Always respond with valid JSON containing detailed exercise information including:
            - Specific coaching cues for proper execution
            - How each exercise benefits position performance
            - Game application examples
            - Safety and injury prevention notes

            Make each workout challenging but appropriate for $experienceLevel level.
        """.trimIndent()
    }

    private fun extractWorkoutTitle(content: String): String? {
        return try {
            val jsonStart = content.indexOf("{")
            val jsonEnd = content.lastIndexOf("}")
            if (jsonStart != -1 && jsonEnd != -1) {
                val json = content.substring(jsonStart, jsonEnd + 1)
                val jsonResponse = objectMapper.readValue(json, Map::class.java) as Map<String, Any>
                jsonResponse["workoutTitle"] as? String
            } else null
        } catch (e: Exception) {
            null
        }
    }

    // Quiz generation
    fun generateQuiz(
        sport: Sport,
        position: Position? = null,
        quizType: QuizType,
        difficultyLevel: DifficultyLevel,
        questionCount: Int = 10
    ): QuizContent {
        val systemPrompt = buildQuizGenerationPrompt(sport, position, quizType, difficultyLevel)
        val userPrompt = "Generate $questionCount quiz questions."
        val claudeResponse = callClaudeApi(userPrompt, systemPrompt)
        return parseQuizResponse(claudeResponse.content)
    }

    // ─── Rate limiting ────────────────────────────────────────────────────────

    private fun checkRateLimit(user: User, isWorkout: Boolean = false) {
        when (user.subscriptionTier) {

            SubscriptionTier.TRIAL -> {
                if (isWorkout) {
                    if (user.trialWorkoutsUsed >= 1) {
                        throw IllegalStateException(
                            "Trial workout limit reached (1 workout). " +
                            "Subscribe to Basic (\$12.99) or Premium (\$19.99) to generate more workouts."
                        )
                    }
                } else {
                    if (user.trialChatsUsed >= 3) {
                        throw IllegalStateException(
                            "Trial chat limit reached (3 questions). " +
                            "Subscribe to Basic (\$12.99) or Premium (\$19.99) to continue coaching."
                        )
                    }
                }
            }

            SubscriptionTier.NONE -> {
                throw IllegalStateException(
                    "No active subscription. Choose Basic (\$12.99) or Premium (\$19.99) to start AI coaching."
                )
            }

            SubscriptionTier.BASIC -> {
                val monthStart = LocalDateTime.now()
                    .withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0)
                val monthlyCostCents = claudeConversationRepository.getCostByUserSince(user, monthStart) ?: 0
                println("DEBUG: BASIC monthly cost: $monthlyCostCents (units of 1/10000 dollar)")
                if (monthlyCostCents >= 40000) {
                    throw IllegalStateException(
                        "Monthly AI budget reached (\$${String.format("%.2f", monthlyCostCents / 10000.0)} of \$4.00). " +
                        "Upgrade to Premium for double the monthly allowance."
                    )
                }
            }

            SubscriptionTier.PREMIUM -> {
                val monthStart = LocalDateTime.now()
                    .withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0)
                val monthlyCostCents = claudeConversationRepository.getCostByUserSince(user, monthStart) ?: 0
                println("DEBUG: PREMIUM monthly cost: $monthlyCostCents (units of 1/10000 dollar)")
                if (monthlyCostCents >= 80000) {
                    throw IllegalStateException(
                        "Monthly AI budget reached (\$${String.format("%.2f", monthlyCostCents / 10000.0)} of \$8.00). " +
                        "Contact support if you need a higher limit."
                    )
                }
            }
        }
        println("DEBUG: Rate limit check completed successfully")
    }

    private fun incrementTrialUsage(user: User, isWorkout: Boolean) {
        if (user.subscriptionTier != SubscriptionTier.TRIAL) return
        val updated = user.copy(
            trialChatsUsed    = if (!isWorkout) user.trialChatsUsed + 1    else user.trialChatsUsed,
            trialWorkoutsUsed = if (isWorkout)  user.trialWorkoutsUsed + 1 else user.trialWorkoutsUsed,
            updatedAt = LocalDateTime.now()
        )
        userRepository.save(updated)
    }

    // ─── System prompt builders ───────────────────────────────────────────────

    private fun buildSystemPrompt(
        sport: Sport?,
        position: Position?,
        conversationType: ConversationType
    ): String {
        if (sport == Sport.GENERAL_FITNESS) {
            return """
                You are an expert personal trainer and fitness coach helping a general fitness user achieve their health and fitness goals. Provide evidence-based, practical advice on exercise, training, and fitness. Stay focused on fitness, health, and wellness topics. If asked about non-fitness topics, politely redirect to health and fitness.

                CRITICAL BEHAVIORAL RULES:
                1. When you need more information before giving advice, ask ONLY yes/no questions. Format each question on its own line starting with exactly [YES/NO] like this:
                [YES/NO] Do you currently have gym access?
                [YES/NO] Are you comfortable with high-intensity training?
                Ask a maximum of 5-6 yes/no questions per response, then STOP. Do not provide any plan, schedule, or recommendations in the same response as your questions. Wait for the user's answers before proceeding.
                2. Never ask open-ended questions. Every question must be answerable with yes or no.
                3. When you determine that a structured workout session would benefit the user based on the conversation, end your response with exactly this phrase on its own line: 'Would you like me to create a workout plan to work towards these goals?'
                4. When proposing a workout plan, include this note: 'Note: creating a workout plan will end this chat session.'
                5. Never generate a full weekly schedule or multi-day program in the chat. Keep responses focused on advice, education, and single actionable recommendations.
                6. Keep responses concise and conversational — 150 to 300 words maximum for non-question responses unless the user explicitly asks for more detail.
            """.trimIndent()
        }

        val basePrompt = """
        You are an expert sports coach and trainer specializing in position-specific athletic development.
        Your responses should be practical, actionable, and focused on helping athletes improve their performance.

        IMPORTANT GUIDELINES:
        - Stay focused on sports, training, and athletic development topics only
        - Provide position-specific advice when possible
        - Include injury prevention considerations
        - Be encouraging and motivational
        - If asked about non-sports topics, politely redirect to athletic training
        - Keep responses concise but comprehensive (200-400 words)
        """.trimIndent()

        val sportSpecific = sport?.let {
            "You are specifically focused on $sport training and development."
        } ?: ""

        val positionSpecific = position?.let {
            "The athlete you're coaching plays the $position position, so tailor your advice accordingly."
        } ?: ""

        val conversationSpecific = when (conversationType) {
            ConversationType.TRAINING_ADVICE -> "Focus on training methodologies and workout recommendations."
            ConversationType.POSITION_SPECIFIC_GUIDANCE -> "Provide position-specific skills and techniques."
            ConversationType.INJURY_PREVENTION -> "Emphasize injury prevention and recovery strategies."
            ConversationType.SKILL_DEVELOPMENT -> "Focus on skill development and technique improvement."
            ConversationType.GAME_STRATEGY -> "Provide tactical and strategic insights."
            ConversationType.WORKOUT_CUSTOMIZATION -> "Help customize workouts for specific needs."
            ConversationType.GENERAL_SPORTS_QUESTION -> "Answer general sports and training questions."
        }

        return "$basePrompt\n\n$sportSpecific\n$positionSpecific\n$conversationSpecific"
    }

    private fun buildWorkoutPlanPrompt(
        sport: Sport,
        position: Position,
        difficultyLevel: DifficultyLevel,
        trainingPhase: TrainingPhase
    ): String {
        val positionSpecificContext = getPositionSpecificContext(sport, position)

        return """
            You are an elite position-specific performance coach for GameIQ - the premier AI-powered sports intelligence platform. Your expertise lies in creating training programs that develop both the PHYSICAL capabilities and TACTICAL INTELLIGENCE required to master the ${position.name.lowercase()} position in $sport.

            GameIQ Philosophy: "Master YOUR Position" - Every exercise should directly translate to on-field performance and tactical advantage.

            ATHLETE PROFILE:
            - Sport: $sport
            - Position: $position
            - Current Level: $difficultyLevel
            - Training Phase: $trainingPhase
            - Focus: Position-specific performance optimization

            POSITION-SPECIFIC CONTEXT:
            ${positionSpecificContext.keyMovements}
            ${positionSpecificContext.commonInjuries}
            ${positionSpecificContext.performanceMetrics}

            Create a workout that embodies "Sports IQ Training" - where every exercise has a clear PURPOSE for position mastery. Return your response as a JSON object with this exact structure:

            {
                "workoutTitle": "Position-specific title that emphasizes mastery (e.g., 'QB Pocket Presence Power Builder')",
                "positionFocus": "2-3 sentence explanation of how this workout specifically improves on-field position performance",
                "exercises": [
                    {
                    "name": "Exercise name",
                    "sets": 3,
                    "reps": "8-12",
                    "restSeconds": 60,
                    "description": "Clear, technical instruction on proper form",
                    "positionBenefit": "Specific explanation of how this translates to better position performance",
                    "gameApplication": "Real game situation where this strength/movement is crucial",
                    "injuryPrevention": "How this exercise prevents common position-specific injuries (if applicable)",
                    "coachingCue": "One key mental cue athletes should focus on during execution"
                    }
                ],
                "equipmentNeeded": "List of required equipment",
                "focusAreas": "Primary muscle groups and movement patterns targeted",
                "estimatedDuration": 45,
                "warmup": "Position-specific warm-up that prepares for the movement patterns in training",
                "cooldown": "Recovery routine emphasizing areas that get stressed in this position",
                "intelligenceNote": "2-3 sentences connecting this physical training to tactical advantages",
                "progressionTip": "How athletes can advance this workout as they master their position",
                "nextLevelUnlock": "What position-specific skill this workout prepares them to tackle next"
            }

            CRITICAL REQUIREMENTS:
            1. Every exercise must have clear position-specific justification
            2. Include 6-8 exercises that target the most important movement patterns for this position
            3. Balance strength, power, mobility, and injury prevention based on position demands
            4. Use coaching language that builds confidence and emphasizes mastery
            5. Reference specific game situations, not just generic "functional movement"
            6. Make the athlete feel like they're training with PURPOSE, not just getting tired

            Remember: This isn't just a workout - it's a step toward position mastery. Make every rep count toward game-day dominance.
        """.trimIndent()
    }

    private fun getPositionSpecificContext(sport: Sport, position: Position): PositionContext {
        return when (sport) {
            Sport.FOOTBALL -> when (position) {
                Position.QB -> PositionContext(
                    keyMovements = "KEY MOVEMENTS: Pocket mobility, quick 3-step drops, throwing mechanics under pressure, hip rotation for torque generation, core stability for accuracy",
                    commonInjuries = "INJURY PREVENTION FOCUS: Shoulder stability, lower back protection, knee valgus prevention during scrambles, rotator cuff health",
                    performanceMetrics = "PERFORMANCE TARGETS: Arm strength for deep throws, pocket awareness (reaction time), accuracy under pressure, scramble mobility"
                )
                Position.RB -> PositionContext(
                    keyMovements = "KEY MOVEMENTS: Explosive first step, lateral cutting, contact balance, vision through holes, stiff-arm power, pass protection stance",
                    commonInjuries = "INJURY PREVENTION FOCUS: ACL protection, shoulder stability for contact, ankle stability for cutting, hamstring flexibility",
                    performanceMetrics = "PERFORMANCE TARGETS: 40-yard dash time, lateral agility, contact balance, vision processing speed"
                )
                Position.WR -> PositionContext(
                    keyMovements = "KEY MOVEMENTS: Route precision, release technique, catch point optimization, RAC ability, contested catch strength",
                    commonInjuries = "INJURY PREVENTION FOCUS: ACL protection during cuts, shoulder stability for catches, hamstring flexibility for speed",
                    performanceMetrics = "PERFORMANCE TARGETS: Route running precision, catch radius, separation speed, contested catch success"
                )
                else -> PositionContext.default()
            }
            Sport.BASKETBALL -> when (position) {
                Position.PG -> PositionContext(
                    keyMovements = "KEY MOVEMENTS: Court vision processing, quick decision-making under pressure, change of pace dribbling, defensive pressure navigation",
                    commonInjuries = "INJURY PREVENTION FOCUS: Ankle stability for cuts, core strength for contact, shoulder health for ball security",
                    performanceMetrics = "PERFORMANCE TARGETS: Court vision speed, assist-to-turnover ratio, defensive pressure handling, leadership presence"
                )
                else -> PositionContext.default()
            }
            Sport.BASEBALL -> when (position) {
                Position.PITCHER -> PositionContext(
                    keyMovements = "KEY MOVEMENTS: Kinetic chain sequencing, hip-shoulder separation, deceleration mechanics, leg drive efficiency",
                    commonInjuries = "INJURY PREVENTION FOCUS: Rotator cuff health, UCL protection, lower back stability, hip mobility",
                    performanceMetrics = "PERFORMANCE TARGETS: Velocity consistency, command accuracy, stamina through pitch counts, injury resilience"
                )
                else -> PositionContext.default()
            }
            Sport.SOCCER -> when (position) {
                Position.GOALKEEPER -> PositionContext(
                    keyMovements = "KEY MOVEMENTS: Explosive diving saves, quick feet for positioning, distribution accuracy, aerial command presence",
                    commonInjuries = "INJURY PREVENTION FOCUS: Shoulder stability for diving, core strength for distribution, hip mobility for low saves",
                    performanceMetrics = "PERFORMANCE TARGETS: Reaction time, distribution accuracy, aerial dominance, shot-stopping percentage"
                )
                else -> PositionContext.default()
            }
            else -> PositionContext.default()
        }
    }

    private data class PositionContext(
        val keyMovements: String,
        val commonInjuries: String,
        val performanceMetrics: String
    ) {
        companion object {
            fun default() = PositionContext(
                keyMovements = "KEY MOVEMENTS: Sport-specific movement patterns and athletic requirements",
                commonInjuries = "INJURY PREVENTION FOCUS: Common sport-related injury prevention",
                performanceMetrics = "PERFORMANCE TARGETS: Position-specific performance indicators"
            )
        }
    }

    data class WorkoutContent(
        val exercisesJson: String,
        val equipmentNeeded: String? = null,
        val focusAreas: String? = null,
        val estimatedDuration: Int? = null,
        val promptUsed: String,
        val enhancedContent: String? = null
    )

    private fun buildQuizGenerationPrompt(
        sport: Sport,
        position: Position?,
        quizType: QuizType,
        difficultyLevel: DifficultyLevel
    ): String {
        val positionText = position?.let { " for $position players" } ?: ""
        return """
        You are a $sport expert creating educational quiz questions$positionText.
        
        Create quiz questions of type: $quizType
        Difficulty level: $difficultyLevel
        
        Return your response as a JSON object with this structure:
        {
          "questions": [
            {
              "question": "The question text",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correctAnswer": 0,
              "explanation": "Why this answer is correct and educational context"
            }
          ]
        }
        
        Make questions challenging but fair for the $difficultyLevel level.
        Focus on practical game situations and real tactical knowledge.
        """.trimIndent()
    }

    private fun buildWorkoutPlanUserPrompt(equipmentAvailable: String?): String {
        val equipmentText = equipmentAvailable?.let {
            "Available equipment: $it"
        } ?: "Assume basic gym equipment is available (dumbbells, barbells, etc.)"
        return "Create a comprehensive workout plan. $equipmentText"
    }

    // ─── API interaction ──────────────────────────────────────────────────────

    private fun callClaudeApi(
        message: String,
        systemPrompt: String,
        conversationHistory: List<ClaudeConversation> = emptyList(),
        maxTokens: Int = 1000
    ): ClaudeApiResponse {
        val headers = HttpHeaders().apply {
            set("x-api-key", claudeApiKey)
            set("anthropic-version", "2023-06-01")
            contentType = MediaType.APPLICATION_JSON
        }

        val messages = mutableListOf<Map<String, String>>()

        conversationHistory.forEach { conversation ->
            messages.add(mapOf("role" to "user", "content" to conversation.userMessage))
            messages.add(mapOf("role" to "assistant", "content" to conversation.claudeResponse))
        }

        messages.add(mapOf("role" to "user", "content" to message))

        val requestBody = mapOf(
            "model" to claudeModel,
            "max_tokens" to maxTokens,
            "system" to systemPrompt,
            "messages" to messages
        )

        val entity = HttpEntity(requestBody, headers)

        try {
            val response = restTemplate.exchange(
                claudeApiUrl,
                HttpMethod.POST,
                entity,
                Map::class.java
            )

            val responseBody = response.body as Map<String, Any>
            val content = (responseBody["content"] as List<Map<String, Any>>)[0]["text"] as String
            val usage = responseBody["usage"] as Map<String, Any>

            return ClaudeApiResponse(
                content = content,
                tokensUsed = TokenUsage(
                    input = usage["input_tokens"] as Int,
                    output = usage["output_tokens"] as Int
                )
            )
        } catch (e: Exception) {
            throw RuntimeException("Failed to call Claude API: ${e.message}", e)
        }
    }

    // ─── Response parsers ─────────────────────────────────────────────────────

    private fun parseWorkoutPlanResponse(content: String, promptUsed: String): WorkoutContent {
        return try {
            val cleanedContent = content
                .replace("```json", "")
                .replace("```", "")
                .trim()

            println("DEBUG: Cleaned content preview: ${cleanedContent.take(200)}...")

            val jsonStartIndex = cleanedContent.indexOf("{")
            val jsonEndIndex = cleanedContent.lastIndexOf("}")

            if (jsonStartIndex != -1 && jsonEndIndex != -1 && jsonEndIndex > jsonStartIndex) {
                val extractedJson = cleanedContent.substring(jsonStartIndex, jsonEndIndex + 1)
                println("DEBUG: Extracted JSON preview: ${extractedJson.take(200)}...")

                val jsonResponse = objectMapper.readValue(extractedJson, Map::class.java) as Map<String, Any>

                val workoutTitle = jsonResponse["workoutTitle"] as String? ?: "Position-Specific Workout"
                val exercises = jsonResponse["exercises"] as List<Map<String, Any>>? ?: emptyList()
                val equipmentNeeded = jsonResponse["equipmentNeeded"] as String? ?: "Basic equipment"
                val focusAreas = jsonResponse["focusAreas"] as String? ?: "Position-specific training"
                val estimatedDuration = (jsonResponse["estimatedDuration"] as Number?)?.toInt() ?: 45

                println("DEBUG: Successfully parsed structured data. Workout: $workoutTitle")
                println("DEBUG: Exercises count: ${exercises.size}")

                WorkoutContent(
                    exercisesJson = objectMapper.writeValueAsString(exercises),
                    equipmentNeeded = equipmentNeeded,
                    focusAreas = focusAreas,
                    estimatedDuration = estimatedDuration,
                    promptUsed = promptUsed,
                    enhancedContent = content
                )
            } else {
                throw IllegalArgumentException("No valid JSON found in Claude response")
            }
        } catch (e: Exception) {
            println("DEBUG: JSON parsing failed, but preserving full Claude response: ${e.message}")
            println("DEBUG: Content preview: ${content.take(200)}...")

            WorkoutContent(
                exercisesJson = """[{"name": "AI-Generated Workout", "sets": 3, "reps": "varies"}]""",
                equipmentNeeded = "As specified by user",
                focusAreas = "Position-specific training",
                estimatedDuration = 45,
                promptUsed = promptUsed,
                enhancedContent = content
            )
        }
    }

    private fun extractWorkoutName(enhancedContent: String?): String? {
        return enhancedContent?.let { content ->
            val titleRegex = Regex("=== (.*?) ===")
            titleRegex.find(content)?.groupValues?.get(1)
        }
    }

    private fun extractPositionFocus(enhancedContent: String?): String? {
        return enhancedContent?.let { content ->
            val focusRegex = Regex("POSITION FOCUS:\\s*([^\\n]+)")
            focusRegex.find(content)?.groupValues?.get(1)
        }
    }

    private fun parseQuizResponse(content: String): QuizContent {
        return try {
            val jsonResponse = objectMapper.readValue(content, Map::class.java) as Map<String, Any>
            val questions = jsonResponse["questions"] as List<Map<String, Any>>
            QuizContent(
                questionsJson = objectMapper.writeValueAsString(questions)
            )
        } catch (e: Exception) {
            throw RuntimeException("Failed to parse quiz response: ${e.message}", e)
        }
    }

    // ─── Cost calculation ─────────────────────────────────────────────────────

    private fun calculateApiCost(inputTokens: Int, outputTokens: Int): Int {
        // Claude Sonnet 4 pricing: $3 per M input tokens, $15 per M output tokens
        val inputCostDollars = inputTokens * 0.000003
        val outputCostDollars = outputTokens * 0.000015
        val totalCostDollars = inputCostDollars + outputCostDollars
        val totalCostCents = kotlin.math.round(totalCostDollars * 10000).toInt()

        println("DEBUG: API Cost Calculation")
        println("  Input tokens: $inputTokens × \$0.000003 = \$${String.format("%.6f", inputCostDollars)}")
        println("  Output tokens: $outputTokens × \$0.000015 = \$${String.format("%.6f", outputCostDollars)}")
        println("  Total cost: \$${String.format("%.6f", totalCostDollars)} = ${totalCostCents} (units of 1/10000 dollar)")

        return totalCostCents
    }

    fun getUserConversations(userId: Long): List<ClaudeConversation> {
        return claudeConversationRepository.findByUserId(userId)
    }
}