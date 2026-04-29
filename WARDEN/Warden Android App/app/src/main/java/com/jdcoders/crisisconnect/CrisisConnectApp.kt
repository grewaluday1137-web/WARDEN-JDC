package com.jdcoders.crisisconnect

import android.app.Application
import com.jdcoders.crisisconnect.services.WardenWebSocketService

class CrisisConnectApp : Application() {

    lateinit var webSocketService: WardenWebSocketService
        private set

    override fun onCreate() {
        super.onCreate()
        webSocketService = WardenWebSocketService()

        // Connect WebSocket to backend
        webSocketService.connect()
    }

    override fun onTerminate() {
        super.onTerminate()
        webSocketService.disconnect()
    }
}
