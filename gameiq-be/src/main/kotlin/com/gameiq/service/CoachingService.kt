package com.gameiq.service

import com.gameiq.entity.*
import com.gameiq.repository.CoachingAnalysisRepository
import com.gameiq.repository.CoachingScenarioRepository
import org.springframework.stereotype.Service
import java.time.LocalDateTime

@Service
class CoachingService(
    private val claudeService: ClaudeService,
    private val coachingAnalysisRepository: CoachingAnalysisRepository,
    private val coachingScenarioRepository: CoachingScenarioRepository
) {

    fun analyzeCoachingSituation(
        userId: Long,
        sport: String,
        situation: CoachingSituationRequest
    ): CoachingAnalysisResponse {

        val prompt = generateCoachingPrompt(sport, situation)

        val conversation = claudeService.chatWithClaude(
            userId = userId,
            message = prompt,
            sport = Sport.valueOf(sport.uppercase()),
            conversationType = ConversationType.GAME_STRATEGY
        )

        val analysis = CoachingAnalysis(
            userId = userId,
            sport = sport,
            scenario = situation.toString(),
            recommendation = conversation.claudeResponse,
            successProbability = "Based on historical analysis",
            reasoning = "Strategic analysis based on coaching principles",
            alternatives = "Alternative strategies available"
        )

        coachingAnalysisRepository.save(analysis)

        return CoachingAnalysisResponse(
            sport = sport,
            recommendation = conversation.claudeResponse,
            successProbability = "Based on historical analysis",
            reasoning = "Strategic analysis based on coaching principles",
            alternatives = "Alternative strategies available",
            timestamp = LocalDateTime.now().toString(),
            conversationId = conversation.id
        )
    }

    private fun generateCoachingPrompt(sport: String, situation: CoachingSituationRequest): String {
        return when (sport.uppercase()) {
            "FOOTBALL"   -> generateFootballCoachingPrompt(situation)
            "BASKETBALL" -> generateBasketballCoachingPrompt(situation)
            "BASEBALL"   -> generateBaseballCoachingPrompt(situation)
            else         -> generateGenericCoachingPrompt(sport, situation)
        }
    }

    private fun generateFootballCoachingPrompt(situation: CoachingSituationRequest): String {
        return """
        You are an elite NFL/college football coach with 20+ years of experience.
        
        SITUATION ANALYSIS:
        - Down & Distance: ${situation.context["downDistance"]}
        - Field Position: ${situation.context["fieldPosition"]}
        - Score: ${situation.context["score"]}
        - Time Remaining: ${situation.context["timeRemaining"]}
        - Quarter: ${situation.context["quarter"]}
        
        Using historical NFL and collegiate data and coaching principles, analyze this situation and provide:
        
        1. Your primary strategic recommendation
        2. Success probability based on league historical data
        3. 2-3 alternative strategies with their success rates
        4. Key factors that influence this decision
        5. What successful coaches typically do in this situation
        
        Provide a comprehensive strategic analysis.
        """.trimIndent()
    }

    private fun generateBasketballCoachingPrompt(situation: CoachingSituationRequest): String {
        return """
        You are an elite basketball coach with extensive experience.
        Analyze this basketball situation: ${situation.context}
        Provide strategic recommendations based on proven coaching principles.
        """.trimIndent()
    }

    private fun generateBaseballCoachingPrompt(situation: CoachingSituationRequest): String {
        return """
        You are an elite baseball coach and strategist.
        Analyze this baseball situation: ${situation.context}
        Provide strategic recommendations based on historical data and proven tactics.
        """.trimIndent()
    }

    private fun generateGenericCoachingPrompt(sport: String, situation: CoachingSituationRequest): String {
        return """
        You are an elite $sport coach with extensive experience.
        Analyze this $sport situation: ${situation.context}
        Provide strategic recommendations based on proven coaching principles.
        """.trimIndent()
    }
}

data class CoachingSituationRequest(
    val sport: String,
    val context: Map<String, String>
)

data class CoachingAnalysisResponse(
    val sport: String,
    val recommendation: String,
    val successProbability: String,
    val reasoning: String,
    val alternatives: String,
    val timestamp: String,
    val conversationId: Long
)