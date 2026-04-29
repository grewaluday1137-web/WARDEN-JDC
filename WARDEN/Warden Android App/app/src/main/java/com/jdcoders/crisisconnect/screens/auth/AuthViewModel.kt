package com.jdcoders.crisisconnect.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jdcoders.crisisconnect.services.WardenApiService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import android.util.Log

class AuthViewModel : ViewModel() {

    private val apiService = WardenApiService.instance

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    private val _otpSent = MutableStateFlow(false)
    val otpSent: StateFlow<Boolean> = _otpSent

    private val _loginSuccess = MutableStateFlow(false)
    val loginSuccess: StateFlow<Boolean> = _loginSuccess

    var guestName = ""
    var guestRoom = ""
    var guestEmail = ""
    var accessToken = ""

    fun requestOtp(name: String, room: String, email: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val body = mapOf(
                    "name" to name,
                    "room_number" to room,
                    "email" to email
                )
                val response = apiService.requestOtp(body)
                if (response.isSuccessful) {
                    guestName = name
                    guestRoom = room
                    guestEmail = email
                    _otpSent.value = true
                    Log.d("AuthVM", "OTP sent successfully to $email")
                } else {
                    _error.value = "Failed to send OTP: ${response.message()}"
                    Log.e("AuthVM", "Error response: ${response.errorBody()?.string()}")
                }
            } catch (e: Exception) {
                _error.value = "Connection error: ${e.localizedMessage}"
                Log.e("AuthVM", "Request OTP Exception", e)
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun verifyOtp(otp: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val body = mapOf(
                    "otp" to otp,
                    "email" to guestEmail
                )
                val response = apiService.verifyOtp(body)
                if (response.isSuccessful) {
                    val data = response.body()
                    accessToken = data?.get("access_token") as? String ?: ""
                    _loginSuccess.value = true
                    Log.d("AuthVM", "OTP verified successfully")
                } else {
                    _error.value = "Invalid OTP. Please try again."
                    Log.e("AuthVM", "Verify error: ${response.errorBody()?.string()}")
                }
            } catch (e: Exception) {
                _error.value = "Connection error: ${e.localizedMessage}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun resetState() {
        _otpSent.value = false
        _loginSuccess.value = false
        _error.value = null
    }
}
