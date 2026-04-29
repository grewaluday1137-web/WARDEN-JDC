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
fun LocationSharingScreen(navController: NavController) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val sessionManager = remember { com.jdcoders.crisisconnect.utils.SessionManager(context) }

    var shareLiveLocation by remember { mutableStateOf(sessionManager.isLiveLocationSharingEnabled()) }
    var backgroundSharing by remember { mutableStateOf(sessionManager.isBackgroundSharingEnabled()) }
    var notifyContactsOnEmergency by remember { mutableStateOf(sessionManager.isNotifyContactsEnabled()) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Location Sharing", fontWeight = FontWeight.Bold) },
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
            LocationToggleItem(
                "Live Location Sharing",
                "Share your position with first responders during an active SOS",
                shareLiveLocation
            ) { 
                shareLiveLocation = it
                sessionManager.setLiveLocationSharingEnabled(it)
            }

            LocationToggleItem(
                "Background Sharing",
                "Allow app to track location even when closed for better response times",
                backgroundSharing
            ) { 
                backgroundSharing = it
                sessionManager.setBackgroundSharingEnabled(it)
            }

            LocationToggleItem(
                "Notify Contacts",
                "Automatically send your live location to emergency contacts when SOS is triggered",
                notifyContactsOnEmergency
            ) { 
                notifyContactsOnEmergency = it
                sessionManager.setNotifyContactsEnabled(it)
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Privacy Note",
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Your location data is encrypted and only shared during active emergency situations. We do not store your travel history.",
                color = Color.Gray,
                fontSize = 14.sp
            )
        }
    }
}

@Composable
fun LocationToggleItem(title: String, subtitle: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
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
