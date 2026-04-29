package com.jdcoders.crisisconnect.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun AlertBar(
    title: String = "ACTIVE ADVISORY",
    message: String = "Severe weather protocol active. Proceed to designated safety zones if alarms sound.",
    hasActiveCrisis: Boolean = true
) {
    val backgroundColor = if (hasActiveCrisis) Color(0xFFDC2626).copy(alpha = 0.15f) else Color(0xFF10B981).copy(alpha = 0.15f)
    val accentColor = if (hasActiveCrisis) Color(0xFFDC2626) else Color(0xFF10B981)
    val icon = if (hasActiveCrisis) Icons.Default.Warning else Icons.Default.CheckCircle
    val displayTitle = if (hasActiveCrisis) title else "ALL CLEAR"
    val displayMessage = if (hasActiveCrisis) message else "No active emergencies. All systems operational."

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(backgroundColor)
            .padding(16.dp),
        verticalAlignment = Alignment.Top
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = accentColor,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(
                text = displayTitle,
                color = accentColor,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = displayMessage,
                color = Color.White.copy(alpha = 0.8f),
                fontSize = 14.sp,
                lineHeight = 20.sp,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}