package com.jdcoders.crisisconnect.services

import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.*

/**
 * WebSocket client that connects to the WARDEN backend and streams real-time data
 * to the Android app: alerts, AI recommendations, broadcast messages, and simulation ticks.
 */
class WardenWebSocketService {

    private val TAG = "WardenWS"
    private val gson = Gson()
    private var webSocket: WebSocket? = null
    private var isConnecting = false
    private var reconnectAttempt = 0
    private val maxReconnectDelay = 30_000L
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // ── Connection State ──
    private val _connected = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = _connected

    // ── Alert Updates (from AI engine) ──
    data class AlertUpdate(
        val alerts: List<Map<String, Any>>,
        val summary: Map<String, Any>?,
        val recommendations: Map<String, List<String>>?,
        val guest_summary: Map<String, Any>? = null
    )
    private val _alertUpdates = MutableSharedFlow<AlertUpdate>(extraBufferCapacity = 10)
    val alertUpdates: SharedFlow<AlertUpdate> = _alertUpdates

    // ── Broadcast Messages (from desktop) ──
    data class BroadcastMessage(
        val target: String,
        val message: String,
        val timestamp: Long = System.currentTimeMillis()
    )
    private val _broadcastMessages = MutableSharedFlow<BroadcastMessage>(extraBufferCapacity = 10)
    val broadcastMessages: SharedFlow<BroadcastMessage> = _broadcastMessages

    // ── Simulation Ticks (floor states, epicenters) ──
    private val _simulationTicks = MutableSharedFlow<Map<String, Any>>(extraBufferCapacity = 5)
    val simulationTicks: SharedFlow<Map<String, Any>> = _simulationTicks

    fun connect() {
        if (isConnecting || _connected.value) return
        isConnecting = true

        val url = ApiConfig.getWebSocketUrl()
        Log.d(TAG, "Connecting to $url")

        val request = Request.Builder()
            .url(url)
            .header("User-Agent", "WardenAndroidApp/1.0")
            .build()
        
        Log.d(TAG, "🔌 Connecting to WebSocket: $url")

        webSocket = ApiConfig.okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "✅ Connected to backend WebSocket")
                _connected.value = true
                isConnecting = false
                reconnectAttempt = 0
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val mapType = object : TypeToken<Map<String, Any>>() {}.type
                    val payload: Map<String, Any> = gson.fromJson(text, mapType)
                    val type = payload["type"] as? String ?: return

                    when (type) {
                        "Alert_update" -> {
                            val data = payload["data"] as? Map<*, *> ?: return
                            val alerts = (data["alerts"] as? List<*>)?.filterIsInstance<Map<String, Any>>() ?: emptyList()
                            
                            val summary = (data["summary"] as? Map<*, *>)?.filterKeys { it is String }?.mapKeys { it.key as String }?.filterValues { it != null }?.mapValues { it.value!! }
                            val guestSummary = (data["guest_summary"] as? Map<*, *>)?.filterKeys { it is String }?.mapKeys { it.key as String }?.filterValues { it != null }?.mapValues { it.value!! }
                            
                            val recsRaw = data["recommendations"] as? Map<*, *>
                            val recs = recsRaw?.filterKeys { it is String }?.mapKeys { it.key as String }?.mapValues { entry -> (entry.value as? List<*>)?.filterIsInstance<String>() ?: emptyList() }
                            
                            _alertUpdates.tryEmit(AlertUpdate(alerts, summary, recs, guestSummary))
                            Log.d(TAG, "📥 Alert_update: ${alerts.size} alerts (Guest Summary: ${guestSummary != null})")
                        }

                        "broadcast_message" -> {
                            val data = payload["data"] as? Map<*, *> ?: return
                            val msg = BroadcastMessage(
                                target = data["target"] as? String ?: "both",
                                message = data["message"] as? String ?: ""
                            )
                            _broadcastMessages.tryEmit(msg)
                            Log.d(TAG, "📢 Broadcast: ${msg.message}")
                        }

                        "simulation_tick" -> {
                            val dataRaw = payload["data"] as? Map<*, *> ?: return
                            val data = dataRaw.filterKeys { it is String }.mapKeys { it.key as String }.filterValues { it != null }.mapValues { it.value!! }
                            _simulationTicks.tryEmit(data)
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing message: ${e.message}")
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "❌ WebSocket failure: ${t.message}")
                _connected.value = false
                isConnecting = false
                scheduleReconnect()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.w(TAG, "❌ WebSocket closed: $reason")
                _connected.value = false
                isConnecting = false
                scheduleReconnect()
            }
        })
    }

    private fun scheduleReconnect() {
        val delay = minOf(1000L * (1 shl reconnectAttempt), maxReconnectDelay)
        reconnectAttempt++
        Log.d(TAG, "Reconnecting in ${delay}ms (attempt $reconnectAttempt)")
        scope.launch {
            delay(delay)
            connect()
        }
    }

    fun disconnect() {
        webSocket?.close(1000, "App closing")
        webSocket = null
        _connected.value = false
        scope.cancel()
    }
}
