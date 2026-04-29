package com.jdcoders.crisisconnect.screens.home

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jdcoders.crisisconnect.services.WardenWebSocketService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Central ViewModel for WARDEN data flowing from the backend WebSocket.
 * Provides live alerts, AI summaries, broadcast messages, and floor states
 * to all screens in the app.
 */
class WardenViewModel(
    private val webSocketService: WardenWebSocketService
) : ViewModel() {

    // ── Connection State ──
    val isConnected: StateFlow<Boolean> = webSocketService.connected

    // ── Alert Summary (from AI engine) ──
    private val _alertSummary = MutableStateFlow("Severe weather protocol active. Proceed to designated safety zones if alarms sound.")
    val alertSummary: StateFlow<String> = _alertSummary

    private val _alertTitle = MutableStateFlow("ACTIVE ADVISORY")
    val alertTitle: StateFlow<String> = _alertTitle

    private val _hasActiveCrisis = MutableStateFlow(false)
    val hasActiveCrisis: StateFlow<Boolean> = _hasActiveCrisis

    // ── AI Recommendations (staff/guest) ──
    private val _guestActions = MutableStateFlow<List<String>>(emptyList())
    val guestActions: StateFlow<List<String>> = _guestActions

    private val _staffActions = MutableStateFlow<List<String>>(emptyList())
    val staffActions: StateFlow<List<String>> = _staffActions

    // ── Live Alerts ──
    data class AlertItem(
        val id: String,
        val title: String,
        val description: String,
        val time: String,
        val severity: String,
        val timestamp: Long
    )
    // ── AI Service ──
    private val aiService = com.jdcoders.crisisconnect.services.WardenAIService()

    private val _alerts = MutableStateFlow<List<AlertItem>>(emptyList())
    val alerts: StateFlow<List<AlertItem>> = _alerts

    // ── Broadcast Messages ──
    data class BroadcastItem(
        val target: String,
        val message: String,
        val timestamp: Long
    )
    private val _broadcasts = MutableStateFlow<List<BroadcastItem>>(emptyList())
    val broadcasts: StateFlow<List<BroadcastItem>> = _broadcasts

    // ── Guest-level Alerts (simplified) ──
    data class GuestAlertItem(
        val event: String,
        val floor: String,
        val near: String,
        val timestamp: Long
    )
    private val _guestAlerts = MutableStateFlow<List<GuestAlertItem>>(emptyList())
    val guestAlerts: StateFlow<List<GuestAlertItem>> = _guestAlerts

    // ── Live Location Tracking ──
    private val _liveLocationNodeId = MutableStateFlow<String?>(null)
    val liveLocationNodeId: StateFlow<String?> = _liveLocationNodeId

    fun shareLiveLocation(floorId: com.jdcoders.crisisconnect.map.FloorId) {
        val floorData = com.jdcoders.crisisconnect.map.WardenMapData.floors[floorId] ?: return
        // Pick a random room or open area node
        val candidates = floorData.nodes.filter { it.type in listOf("room", "open_area", "lab", "office") }
        if (candidates.isNotEmpty()) {
            val node = candidates.random()
            _liveLocationNodeId.value = node.id
            
            viewModelScope.launch {
                try {
                    // 1. Send Alert to Backend (for mobile notifications)
                    val alertPayload = mapOf(
                        "source" to "guest",
                        "location" to mapOf("floor" to floorId.key, "room" to node.id),
                        "metadata" to mapOf(
                            "event_type" to "location_sharing",
                            "event_msg" to "Guest shared live location",
                            "intensity" to "info",
                            "zone_id" to node.id,
                            "floor" to floorId.key
                        )
                    )
                    com.jdcoders.crisisconnect.services.WardenApiService.instance.sendAlert(alertPayload)
                } catch (e: Exception) {
                    Log.e("WardenVM", "Failed to send alert: ${e.message}")
                }
                
                try {
                    // 2. Inject into Simulation to pulse on Desktop Map
                    val injectPayload = mapOf(
                        "zone" to "A", // Fallback zone if node mapping isn't perfectly strict
                        "incidentType" to "medical_emergency", // Will pulse as a standard incident on desktop
                        "floor" to if (floorId.key == "F1_GROUND") 1 else if (floorId.key == "F2_FIRST") 2 else 3,
                        "nodeId" to node.id
                    )
                    
                    val apiConfig = com.jdcoders.crisisconnect.services.ApiConfig
                    val url = "${apiConfig.BASE_URL}/api/inject"
                    
                    val json = org.json.JSONObject(injectPayload).toString()
                    val mediaType = "application/json".toMediaTypeOrNull()
                    val requestBody = json.toRequestBody(mediaType)
                    val request = okhttp3.Request.Builder().url(url).post(requestBody).build()
                    
                    withContext(Dispatchers.IO) {
                        okhttp3.OkHttpClient().newCall(request).execute().use { response ->
                            Log.d("WardenVM", "Simulation inject response: ${response.code}")
                        }
                    }
                } catch (e: Exception) {
                    Log.e("WardenVM", "Failed to inject simulation: ${e.message}")
                }
            }
        }
    }

    // ── Floor Crisis States (for map) ──
    private val _floorStates = MutableStateFlow<Map<String, Any>>(emptyMap())
    val floorStates: StateFlow<Map<String, Any>> = _floorStates

    private val _floorEpicenters = MutableStateFlow<Map<String, Any>>(emptyMap())
    val floorEpicenters: StateFlow<Map<String, Any>> = _floorEpicenters

    init {
        collectAlertUpdates()
        collectBroadcasts()
        collectSimulationTicks()
    }

    private fun collectAlertUpdates() {
        viewModelScope.launch {
            webSocketService.alertUpdates.collect { update ->
                Log.d("WardenVM", "Alert update received: ${update.alerts.size} alerts")
                
                // 🚀 TRIGGER LOCAL AI REASONING (Gemini Cloud)
                if (update.alerts.isNotEmpty()) {
                    viewModelScope.launch {
                        val alertMsgs = update.alerts.mapNotNull { 
                            (it["metadata"] as? Map<*, *>)?.get("event_msg")?.toString() 
                        }
                        val aiResult = aiService.analyzeCrisisState(alertMsgs)
                        _alertSummary.value = aiResult
                        _alertTitle.value = "WARDEN AI INSIGHT"
                        _hasActiveCrisis.value = true
                    }
                }

                // Update Guest Alerts (Simplified)
                update.guest_summary?.let { gs ->
                    val item = GuestAlertItem(
                        event = gs["event"] as? String ?: "Incident",
                        floor = gs["floor"] as? String ?: "Unknown",
                        near = gs["near"] as? String ?: "Unknown",
                        timestamp = System.currentTimeMillis()
                    )
                    _guestAlerts.value = (listOf(item) + _guestAlerts.value).take(20)
                }

                // Update recommendations
                update.recommendations?.let { recs ->
                    _guestActions.value = recs["guest"] ?: emptyList()
                    _staffActions.value = recs["staff"] ?: emptyList()
                }

                // Add alerts to list
                val newAlerts = update.alerts.map { alertMap ->
                    val metadata = alertMap["metadata"] as? Map<*, *>
                    val eventMsg = metadata?.get("event_msg") as? String ?: "Critical Incident"
                    val source = alertMap["source"] as? String ?: "system"
                    val intensity = metadata?.get("intensity") as? String ?: "info"
                    val ts = (alertMap["timestamp"] as? Number)?.toLong() ?: (System.currentTimeMillis() / 1000)
                    
                    AlertItem(
                        id = alertMap["id"]?.toString() ?: System.currentTimeMillis().toString(),
                        title = "$source Alert".replaceFirstChar { it.uppercase() },
                        description = eventMsg,
                        time = formatTimeAgo(ts * 1000),
                        severity = intensity,
                        timestamp = ts * 1000
                    )
                }
                
                // Prepend new alerts, keep max 50
                _alerts.value = (newAlerts + _alerts.value).take(50)
            }
        }
    }

    private fun collectBroadcasts() {
        viewModelScope.launch {
            webSocketService.broadcastMessages.collect { msg ->
                Log.d("WardenVM", "Broadcast received: ${msg.message}")
                val item = BroadcastItem(
                    target = msg.target,
                    message = msg.message,
                    timestamp = msg.timestamp
                )
                _broadcasts.value = listOf(item) + _broadcasts.value
            }
        }
    }

    private fun collectSimulationTicks() {
        viewModelScope.launch {
            webSocketService.simulationTicks.collect { data ->
                // Extract floor states and epicenters for map rendering
                val fStates = data["floorStates"] as? Map<String, Any>
                if (fStates != null) _floorStates.value = fStates

                val fEpicenters = data["floorEpicenters"] as? Map<String, Any>
                if (fEpicenters != null) _floorEpicenters.value = fEpicenters
            }
        }
    }

    private fun formatTimeAgo(timestampMs: Long): String {
        val now = System.currentTimeMillis()
        val diff = now - timestampMs
        return when {
            diff < 60_000 -> "Just now"
            diff < 3600_000 -> "${diff / 60_000}m ago"
            diff < 86400_000 -> "${diff / 3600_000}h ago"
            else -> "${diff / 86400_000}d ago"
        }
    }
}
