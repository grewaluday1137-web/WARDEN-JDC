package com.jdcoders.crisisconnect.screens.settings

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsSettingsScreen(navController: NavController) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val sessionManager = remember { com.jdcoders.crisisconnect.utils.SessionManager(context) }

    var pushEnabled by remember { mutableStateOf(sessionManager.isPushEnabled()) }
    var smsEnabled by remember { mutableStateOf(sessionManager.isSmsEnabled()) }
    var emergencyBroadcasting by remember { mutableStateOf(sessionManager.isEmergencyBroadcastingEnabled()) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Notifications", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF020617),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        },
        containerColor = Color(0xFF020617)
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            NotificationToggleItem("Push Notifications", "Receive real-time alerts on your device", pushEnabled) { 
                pushEnabled = it
                sessionManager.setPushEnabled(it)
            }
            NotificationToggleItem("SMS Alerts", "Get emergency updates via text message", smsEnabled) { 
                smsEnabled = it
                sessionManager.setSmsEnabled(it)
            }
            NotificationToggleItem("Emergency Broadcasting", "Allow device to broadcast loud alerts during crises", emergencyBroadcasting) { 
                emergencyBroadcasting = it
                sessionManager.setEmergencyBroadcastingEnabled(it)
            }
        }
    }
}

@Composable
fun NotificationToggleItem(title: String, subtitle: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Text(subtitle, color = Color.Gray, fontSize = 14.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = Color(0xFFDC2626)
            )
        )
    }
}