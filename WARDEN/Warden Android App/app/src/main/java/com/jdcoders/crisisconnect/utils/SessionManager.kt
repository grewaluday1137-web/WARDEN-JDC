package com.jdcoders.crisisconnect.utils

import android.content.Context
import android.content.SharedPreferences

/**
 * Manages user session and authentication tokens.
 */
class SessionManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val PREF_NAME = "warden_prefs"
        private const val KEY_TOKEN = "access_token"
        private const val KEY_NAME = "user_name"
        private const val KEY_EMAIL = "user_email"
        private const val KEY_ROOM = "user_room"
        private const val KEY_IS_LOGGED_IN = "is_logged_in"
        
        // Settings Keys
        private const val KEY_LANGUAGE = "setting_language"
        private const val KEY_PUSH_ENABLED = "setting_push_enabled"
        private const val KEY_SMS_ENABLED = "setting_sms_enabled"
        private const val KEY_EMERGENCY_BROADCASTING = "setting_emergency_broadcasting"
        private const val KEY_SHARE_LIVE_LOCATION = "setting_share_live_location"
        private const val KEY_BACKGROUND_SHARING = "setting_background_sharing"
        private const val KEY_NOTIFY_CONTACTS = "setting_notify_contacts"
    }

    fun saveSession(token: String, name: String, email: String, room: String) {
        prefs.edit().apply {
            putString(KEY_TOKEN, token)
            putString(KEY_NAME, name)
            putString(KEY_EMAIL, email)
            putString(KEY_ROOM, room)
            putBoolean(KEY_IS_LOGGED_IN, true)
            apply()
        }
    }

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)
    fun getName(): String? = prefs.getString(KEY_NAME, null)
    fun getEmail(): String? = prefs.getString(KEY_EMAIL, null)
    fun getRoom(): String? = prefs.getString(KEY_ROOM, null)
    fun isLoggedIn(): Boolean = prefs.getBoolean(KEY_IS_LOGGED_IN, false)

    // ─── Settings Persistence ───
    fun getLanguage(): String = prefs.getString(KEY_LANGUAGE, "English (US)") ?: "English (US)"
    fun setLanguage(language: String) = prefs.edit().putString(KEY_LANGUAGE, language).apply()

    fun isPushEnabled(): Boolean = prefs.getBoolean(KEY_PUSH_ENABLED, true)
    fun setPushEnabled(enabled: Boolean) = prefs.edit().putBoolean(KEY_PUSH_ENABLED, enabled).apply()

    fun isSmsEnabled(): Boolean = prefs.getBoolean(KEY_SMS_ENABLED, false)
    fun setSmsEnabled(enabled: Boolean) = prefs.edit().putBoolean(KEY_SMS_ENABLED, enabled).apply()

    fun isEmergencyBroadcastingEnabled(): Boolean = prefs.getBoolean(KEY_EMERGENCY_BROADCASTING, true)
    fun setEmergencyBroadcastingEnabled(enabled: Boolean) = prefs.edit().putBoolean(KEY_EMERGENCY_BROADCASTING, enabled).apply()

    fun isLiveLocationSharingEnabled(): Boolean = prefs.getBoolean(KEY_SHARE_LIVE_LOCATION, true)
    fun setLiveLocationSharingEnabled(enabled: Boolean) = prefs.edit().putBoolean(KEY_SHARE_LIVE_LOCATION, enabled).apply()

    fun isBackgroundSharingEnabled(): Boolean = prefs.getBoolean(KEY_BACKGROUND_SHARING, false)
    fun setBackgroundSharingEnabled(enabled: Boolean) = prefs.edit().putBoolean(KEY_BACKGROUND_SHARING, enabled).apply()

    fun isNotifyContactsEnabled(): Boolean = prefs.getBoolean(KEY_NOTIFY_CONTACTS, true)
    fun setNotifyContactsEnabled(enabled: Boolean) = prefs.edit().putBoolean(KEY_NOTIFY_CONTACTS, enabled).apply()

    fun logout() {
        prefs.edit().clear().apply()
    }
}
