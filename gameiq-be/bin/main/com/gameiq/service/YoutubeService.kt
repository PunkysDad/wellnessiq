package com.gameiq.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import org.springframework.web.util.UriComponentsBuilder
import org.slf4j.LoggerFactory

@Service
class YoutubeService(
    private val restTemplate: RestTemplate = RestTemplate(),
    private val objectMapper: ObjectMapper = jacksonObjectMapper()
) {

    @Value("\${youtube.api-key}")
    private lateinit var youtubeApiKey: String

    @Value("\${claude.api.key}")
    private lateinit var claudeApiKey: String

    @Value("\${claude.api.url:https://api.anthropic.com/v1/messages}")
    private lateinit var claudeApiUrl: String

    private val haikuModel = "claude-haiku-4-5-20251001"

    private val logger = LoggerFactory.getLogger(YoutubeService::class.java)

    fun cleanSearchQuery(query: String): String {
        return query
            .replace(Regex("""^\d+\.\s*"""), "")
            .replace(Regex("""\s*\(\d+\s+seconds?\)"""), "")
            .trim()
    }

    private fun generateOptimizedSearchQuery(exerciseName: String): String? {
        return try {
            val headers = HttpHeaders().apply {
                set("x-api-key", claudeApiKey)
                set("anthropic-version", "2023-06-01")
                contentType = MediaType.APPLICATION_JSON
            }

            val prompt = "Generate the best YouTube search query to find an instructional video " +
                "demonstrating this exercise: '$exerciseName'. Return only the search query string, " +
                "no explanation, no quotes, nothing else."

            val messages = listOf(mapOf("role" to "user", "content" to prompt))

            val requestBody = mapOf(
                "model" to haikuModel,
                "max_tokens" to 100,
                "messages" to messages
            )

            val entity = HttpEntity(requestBody, headers)

            val response = restTemplate.exchange(
                claudeApiUrl,
                HttpMethod.POST,
                entity,
                Map::class.java
            )

            val responseBody = response.body as Map<String, Any>
            val content = (responseBody["content"] as List<Map<String, Any>>)[0]["text"] as String
            content.trim().takeIf { it.isNotBlank() }
        } catch (e: Exception) {
            logger.warn("Haiku search-query generation failed, using fallback: ${e.message}")
            null
        }
    }

    fun searchExerciseVideos(query: String): List<YoutubeVideoResult> {
        logger.info("YouTube search requested for: $query")

        val haikuQuery = generateOptimizedSearchQuery(query)
        val searchQuery = if (haikuQuery != null) {
            logger.info("Haiku generated query: $haikuQuery")
            haikuQuery
        } else {
            val fallback = cleanSearchQuery(query) + " how to"
            logger.info("Using fallback query: $fallback")
            fallback
        }

        val uri = UriComponentsBuilder
            .fromHttpUrl("https://www.googleapis.com/youtube/v3/search")
            .queryParam("part", "snippet")
            .queryParam("q", searchQuery)
            .queryParam("type", "video")
            .queryParam("maxResults", 5)
            .queryParam("order", "relevance")
            .queryParam("key", youtubeApiKey)
            .build()
            .toUri()

        logger.info("Calling YouTube API with URI: $uri")

        val response = restTemplate.getForObject(uri, String::class.java)
            ?: return emptyList()

        val root = objectMapper.readTree(response)
        val items = root.get("items") ?: return emptyList()

        return items.mapNotNull { item ->
            val videoId = item.get("id")?.get("videoId")?.asText() ?: return@mapNotNull null
            val snippet = item.get("snippet") ?: return@mapNotNull null
            val title = snippet.get("title")?.asText() ?: return@mapNotNull null
            val channelName = snippet.get("channelTitle")?.asText() ?: ""
            val thumbnails = snippet.get("thumbnails")
            val thumbnail = thumbnails?.get("high")?.get("url")?.asText()
                ?: thumbnails?.get("medium")?.get("url")?.asText()
                ?: ""

            YoutubeVideoResult(
                videoId = videoId,
                title = title,
                thumbnail = thumbnail,
                channelName = channelName
            )
        }
    }
}
