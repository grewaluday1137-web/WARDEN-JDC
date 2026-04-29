package com.jdcoders.crisisconnect.screens.map

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import com.jdcoders.crisisconnect.components.AlertBar

@Composable
fun MapScreen(
    isSosSent: Boolean,
    navToDetails: () -> Unit
) {

    // 🔥 FUTURE API DATA (NULL FOR NOW)
    var roomNumber by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Transparent)
    ) {

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {

            // 🔥 HEADER (STATIC TITLE ONLY)
            Text(
                text = "Your Room",
                fontSize = 35.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )

            Spacer(modifier = Modifier.height(20.dp))

            // 🔥 ROOM CARD (NO HARDCODE)
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = Color.White.copy(alpha = 0.08f)
                ),
                shape = RoundedCornerShape(15.dp)
            ) {

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(70.dp),
                    contentAlignment = Alignment.CenterStart
                ) {

                    if (roomNumber != null) {
                        Text(
                            text = roomNumber!!,
                            color = Color.White,
                            fontSize = 20.sp,
                            modifier = Modifier.padding(horizontal = 20.dp)
                        )
                    }

                    // 🔥 ELSE → EMPTY (clean UI, no fake text)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // 🔥 ALERT BAR (KEEP AS IS)
            AlertBar()
        }

        // 🔥 MAP AREA (MINIMAL PLACEHOLDER — NO TEXT)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(280.dp)
                .padding(horizontal = 16.dp)
                .clip(RoundedCornerShape(30.dp))
                .background(Color.White.copy(alpha = 0.05f))
        )
    }
}