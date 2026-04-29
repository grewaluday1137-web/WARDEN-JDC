package com.jdcoders.crisisconnect.map

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun MapOverlay(selectedRoom: Room?, onClose: () -> Unit) {

    AnimatedVisibility(
        visible = selectedRoom != null,
        enter = fadeIn() + scaleIn(),
        exit = fadeOut() + scaleOut()
    ) {

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.6f))
        ) {

            Column(
                modifier = Modifier
                    .align(Alignment.Center)
                    .background(Color(0xFF1E2F40), RoundedCornerShape(24.dp))
                    .padding(24.dp)
            ) {

                Text(
                    text = "Room ${selectedRoom?.id}",
                    color = Color.White,
                    fontSize = 22.sp
                )

                Spacer(modifier = Modifier.height(16.dp))

                Text("• Fire Extinguisher", color = Color.White)
                Text("• Emergency Exit Nearby", color = Color.White)
                Text("• Medical Kit Available", color = Color.White)

                Spacer(modifier = Modifier.height(20.dp))

                Text(
                    "Tap anywhere to close",
                    color = Color.Gray,
                    fontSize = 12.sp,
                    modifier = Modifier.clickable { onClose() }
                )
            }
        }
    }
}