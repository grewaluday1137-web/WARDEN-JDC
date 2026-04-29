package com.jdcoders.crisisconnect.services

import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.content
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * WardenAIService handles cloud-based AI reasoning for the Android app using Gemini.
 * It provides tactical summaries and safety recommendations for field responders.
 */
class WardenAIService {
    private val apiKey = "AIzaSyB8Nmal5Je-C-vEHF_HClRljXtruMIn6vg"
    private val model = GenerativeModel(
        modelName = "gemini-1.5-flash",
        apiKey = apiKey
    )

    suspend fun analyzeCrisisState(alerts: List<String>): String = withContext(Dispatchers.IO) {
        if (alerts.isEmpty()) return@withContext "System normal. No active threats detected."

        val prompt = """
            You are WARDEN AI, a tactical crisis management assistant.
            The following alerts have been triggered in the building:
            ${alerts.joinToString("\n")}
            
            Based on this information, provide:
            1. A concise situation summary.
            2. Three critical safety actions for responders.
            3. Estimated threat level (Low, Medium, High, Extreme).
            
            Keep your response professional, tactical, and brief.
        """.trimIndent()

        try {
            val response = model.generateContent(
                content {
                    text(prompt)
                }
            )
            response.text ?: "Unable to generate analysis at this time."
        } catch (e: Exception) {
            "AI Analysis Offline: ${e.localizedMessage}"
        }
    }
}
