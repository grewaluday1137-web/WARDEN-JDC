package com.jdcoders.crisisconnect.services

import retrofit2.Response
import retrofit2.http.*

/**
 * Retrofit interface for WARDEN backend REST API.
 */
interface WardenApiService {

    // ── Alert / SOS ──
    @POST("alert")
    suspend fun sendAlert(@Body alert: Map<String, @JvmSuppressWildcards Any>): Response<Map<String, String>>

    @POST("api/mobile/sos")
    suspend fun sendSosAlert(@Body alert: Map<String, @JvmSuppressWildcards Any>): Response<Map<String, Any>>

    // ── Broadcast ──
    @POST("api/broadcast")
    suspend fun sendBroadcast(@Body body: Map<String, String>): Response<Map<String, String>>

    // ── Auth ──
    @FormUrlEncoded
    @POST("auth/login")
    suspend fun login(
        @Field("username") username: String,
        @Field("password") password: String
    ): Response<Map<String, String>>

    @POST("auth/signup/guest")
    suspend fun registerGuest(@Body body: Map<String, @JvmSuppressWildcards Any>): Response<Map<String, String>>

    @POST("auth/guest/request-otp")
    suspend fun requestOtp(@Body body: Map<String, @JvmSuppressWildcards Any>): Response<Map<String, Any>>

    @POST("auth/guest/verify-otp")
    suspend fun verifyOtp(@Body body: Map<String, @JvmSuppressWildcards Any>): Response<Map<String, Any>>

    @GET("auth/me")
    suspend fun getMe(@Header("Authorization") token: String): Response<Map<String, Any>>

    companion object {
        val instance: WardenApiService by lazy {
            ApiConfig.retrofit.create(WardenApiService::class.java)
        }
    }
}
