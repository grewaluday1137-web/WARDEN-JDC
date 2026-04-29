package com.jdcoders.crisisconnect.screens.auth

import com.jdcoders.crisisconnect.utils.*
import android.Manifest
import android.os.Build
import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.draw.*
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.*
import androidx.compose.ui.platform.LocalHapticFeedback

@Composable
fun PermissionScreen(navController: NavController) {

    val context = LocalContext.current
    val haptic = LocalHapticFeedback.current

    var locationGranted by remember { mutableStateOf(false) }
    var notificationGranted by remember { mutableStateOf(false) }
    var micGranted by remember { mutableStateOf(false) }

    var whyExpanded by remember { mutableStateOf(false) }

    val arrowRotation by animateFloatAsState(
        targetValue = if (whyExpanded) 180f else 0f,
        animationSpec = tween(300),
        label = ""
    )

    val locationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { locationGranted = it }

    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { notificationGranted = it }

    val micLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { micGranted = it }

    // 🔥 REAL PERMISSION SYNC
    LaunchedEffect(Unit) {
        locationGranted = hasLocationPermission(context)
        notificationGranted = hasNotificationPermission(context)
        micGranted = hasMicPermission(context)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color(0xFF07121C),
                        Color(0xFF0E2436)
                    )
                )
            )
            .padding(20.dp)
    ) {

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.Center
        ) {

            Text(
                "Stay Protected",
                fontSize = 30.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                "Enable permissions to ensure your safety in emergencies.",
                color = Color.Gray
            )

            Spacer(modifier = Modifier.height(30.dp))

            PermissionCard(Icons.Default.LocationOn,
                "Location Access",
                "Used to detect your live location\nduring SOS",
                locationGranted
            ) {
                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                locationLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            }

            Spacer(modifier = Modifier.height(14.dp))

            PermissionCard(Icons.Default.Notifications,
                "Notifications",
                "Receive emergency alerts instantly",
                notificationGranted
            ) {
                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                if (Build.VERSION.SDK_INT >= 33) {
                    notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else notificationGranted = true
            }

            Spacer(modifier = Modifier.height(14.dp))

            PermissionCard(Icons.Default.Mic,
                "Microphone Access",
                "Used only during emergency voice triggers",
                micGranted
            ) {
                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                micLauncher.launch(Manifest.permission.RECORD_AUDIO)
            }

            Spacer(modifier = Modifier.height(20.dp))

            // 🔥 COMPACT EXPANDABLE
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White.copy(alpha = 0.05f))
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) {
                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        whyExpanded = !whyExpanded
                    }
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {

                Column {

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {

                        Text("Why we need this", color = Color.White)

                        Icon(
                            Icons.Default.KeyboardArrowDown,
                            null,
                            tint = Color.White,
                            modifier = Modifier.rotate(arrowRotation)
                        )
                    }

                    AnimatedVisibility(visible = whyExpanded) {

                        Column(modifier = Modifier.padding(top = 10.dp)) {

                            InfoRow(Icons.Default.LocationOn,
                                "Live location is shared only during emergencies.")

                            Spacer(modifier = Modifier.height(6.dp))

                            InfoRow(Icons.Default.Mic,
                                "Microphone activates only for SOS triggers.")

                            Spacer(modifier = Modifier.height(6.dp))

                            InfoRow(Icons.Default.Notifications,
                                "Notifications ensure instant alerts.")
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(30.dp))

            Text("Your Privacy Matters",
                color = Color.White,
                fontWeight = FontWeight.SemiBold)

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                "We do not store or misuse your data. Permissions are only active during emergencies.",
                color = Color.Gray,
                fontSize = 13.sp
            )

            Spacer(modifier = Modifier.height(30.dp))

            val enabled = areAllPermissionsGranted(context) // 🔥 REAL CHECK

            Button(
                onClick = {
                    val prefs = context.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
                    prefs.edit().putBoolean("permissions_done", true).apply()

                    navController.navigate("home") {
                        popUpTo("permissions") { inclusive = true }
                    }
                },
                enabled = enabled,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(58.dp),
                shape = RoundedCornerShape(18.dp)
            ) {
                Text("Continue")
            }
        }
    }
}

@Composable
fun InfoRow(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {

        Icon(icon, null, tint = Color.Gray, modifier = Modifier.size(14.dp))
        Spacer(modifier = Modifier.width(6.dp))
        Text(text, color = Color.Gray, fontSize = 12.sp)
    }
}

@Composable
fun PermissionCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    description: String,
    isEnabled: Boolean,
    onClick: () -> Unit
) {

    val glowColor = if (isEnabled) Color(0xFF00D4EC) else Color.White

    Box(
        modifier = Modifier
            .fillMaxWidth()
            // ❌ REMOVE SHADOW COMPLETELY (THIS IS THE BUG)
            //.shadow(6.dp, RoundedCornerShape(20.dp))
            .clip(RoundedCornerShape(20.dp))
            .background(
                Color.White.copy(alpha = 0.06f) // ✅ SIMPLE CLEAN GLASS
            )
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() }
            ) { onClick() }
    ) {

        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {

            Icon(icon, null, tint = glowColor, modifier = Modifier.size(22.dp))

            Spacer(modifier = Modifier.width(10.dp))

            Column(modifier = Modifier.weight(1f)) {

                Text(title, color = Color.White)

                Spacer(modifier = Modifier.height(2.dp))

                Text(description, color = Color.Gray, fontSize = 12.sp)
            }

            Text(
                if (isEnabled) "Enabled" else "Enable",
                color = glowColor,
                fontWeight = FontWeight.Bold
            )
        }
    }
}