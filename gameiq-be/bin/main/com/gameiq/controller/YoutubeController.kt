package com.gameiq.controller

import com.gameiq.service.YoutubeService
import com.gameiq.service.YoutubeVideoResult
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.slf4j.LoggerFactory

@RestController
@RequestMapping("/youtube")
class YoutubeController @Autowired constructor(
    private val youtubeService: YoutubeService
) {

    private val logger = LoggerFactory.getLogger(YoutubeController::class.java)

    @GetMapping("/search")
    fun searchVideos(@RequestParam query: String): ResponseEntity<List<YoutubeVideoResult>> {
        return try {
            val results = youtubeService.searchExerciseVideos(query)
            ResponseEntity.ok(results)
        } catch (e: Exception) {
            logger.error("YouTube search failed for query: $query", e)
            ResponseEntity.ok(emptyList())
        }
    }
}
