package com.jdcoders.crisisconnect.screens.sos

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jdcoders.crisisconnect.services.WardenApiService
import kotlinx.coroutines.launch

/**
 * ViewModel for the SOS screen. Sends SOS alerts to the backend
 * which then broadcasts them to the desktop and all connected clients.
 */
class SosViewModel : ViewModel() {

    private val TAG = "SosVM"
    private val api = WardenApiService.instance

    /**
     * Sends an SOS alert to the backend.
     * The backend will:
     *  1. Add it to the alert bucket
     *  2. Process it through the AI engine
     *  3. Broadcast to all WebSocket clients (including CrysisDesk desktop)
     */
    fun sendSos() {
        viewModelScope.launch {
            try {
                val alertPayload = mapOf<String, Any>(
                    "source" to "guest",
                    "name" to "Guest User",
                    "room_no" to 402,
                    "floor_no" to 4,
                    "metadata" to mapOf(
                        "type" to "sos",
                        "incident_type" to "sos_emergency",
                        "event_msg" to "SOS ALERT - Guest triggered emergency from mobile device",
                        "intensity" to "critical"
                    ),
                    "timestamp" to (System.currentTimeMillis() / 1000)
                )

                val response = api.sendSosAlert(alertPayload)
                if (response.isSuccessful) {
                    Log.d(TAG, "✅ SOS alert sent successfully")
                } else {
                    Log.e(TAG, "❌ SOS failed: ${response.code()} ${response.message()}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ SOS network error: ${e.message}")
            }
        }
    }

    /**
     * Sends a deactivation signal to the backend.
     */
    fun deactivateSos() {
        viewModelScope.launch {
            try {
                val deactivatePayload = mapOf<String, Any>(
                    "source" to "guest",
                    "name" to "Guest User",
                    "room_no" to 402,
                    "floor_no" to 4,
                    "metadata" to mapOf(
                        "type" to "sos_deactivation",
                        "incident_type" to "sos_deactivation",
                        "event_msg" to "SOS DEACTIVATED - Guest cancelled emergency from mobile device",
                        "intensity" to "info"
                    ),
                    "timestamp" to (System.currentTimeMillis() / 1000)
                )

                val response = api.sendAlert(deactivatePayload)
                if (response.isSuccessful) {
                    Log.d(TAG, "✅ SOS deactivation sent")
                } else {
                    Log.e(TAG, "❌ Deactivation failed: ${response.code()}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Deactivation network error: ${e.message}")
            }
        }
    }
}
