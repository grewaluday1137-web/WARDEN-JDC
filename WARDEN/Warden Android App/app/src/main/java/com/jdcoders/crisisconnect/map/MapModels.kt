package com.jdcoders.crisisconnect.map

import androidx.compose.ui.geometry.Offset

data class Room(
    val id: String,
    val center: Offset
)

enum class SafetyType {
    EXIT, FIRE, MEDICAL
}

data class SafetyPoint(
    val id: String,
    val type: SafetyType,
    val position: Offset
)