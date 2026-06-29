package com.jdcoders.crisisconnect.services

import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Central API configuration for the WARDEN backend.
 * Change BASE_URL to match your backend's IP when running on a physical device.
 */
object ApiConfig {
    // Use 10.0.2.2 for Android Emulator (maps to host localhost)
    // Change to your machine's WiFi IP (e.g. 192.168.1.100) for physical devices
    var BASE_URL = "http://10.0.2.2:8000"

    val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl("$BASE_URL/")
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    fun getWebSocketUrl(): String {
        return BASE_URL.replace("http://", "ws://").replace("https://", "wss://") + "/ws/alerts"
    }
}
