package com.jdcoders.crisisconnect.screens.updates

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.jdcoders.crisisconnect.CrisisConnectApp
import com.jdcoders.crisisconnect.screens.home.WardenViewModel
import androidx.lifecycle.viewmodel.compose.viewModel

data class UpdateItem(
    val id: Int,
    val title: String,
    val description: String,
    val time: String,
    val type: UpdateType
)

enum class UpdateType {
    EMERGENCY, WARNING, INFO
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UpdatesScreen(navController: NavController) {
    val context = LocalContext.current
    val app = context.applicationContext as CrisisConnectApp

    val wardenViewModel: WardenViewModel = viewModel(
        factory = object : androidx.lifecycle.ViewModelProvider.Factory {
            override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>): T {
                return WardenViewModel(app.webSocketService) as T
            }
        }
    )

    val broadcasts by wardenViewModel.broadcasts.collectAsState()
    val guestAlerts by wardenViewModel.guestAlerts.collectAsState()

    // Combine broadcasts and simplified guest alerts
    val liveUpdates = remember(broadcasts, guestAlerts) {
        val broadcastItems = broadcasts.mapIndexed { index, b ->
            UpdateItem(
                id = 10000 + index,
                title = "SYSTEM BROADCAST",
                description = b.message,
                time = formatTimeAgo(b.timestamp),
                type = UpdateType.WARNING
            )
        }
        val alertItems = guestAlerts.mapIndexed { index, a ->
            UpdateItem(
                id = 20000 + index,
                title = a.event.uppercase(),
                description = "Floor: ${a.floor} · Near: ${a.near}",
                time = formatTimeAgo(a.timestamp),
                type = UpdateType.EMERGENCY
            )
        }
        val combined = broadcastItems + alertItems
        if (combined.isEmpty()) {
            listOf(
                UpdateItem(1, "STANDING ORDER", "All guests should remain vigilant and follow staff instructions.", "Recently", UpdateType.INFO),
                UpdateItem(2, "SYSTEM CHECK", "Crisis monitoring systems are active and verified.", "Active", UpdateType.INFO)
            )
        } else {
            combined
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Updates", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
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
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(liveUpdates) { update ->
                UpdateCard(update)
            }
        }
    }
}

@Composable
fun UpdateCard(update: UpdateItem) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.Top
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(
                        when (update.type) {
                            UpdateType.EMERGENCY -> Color(0xFFDC2626).copy(alpha = 0.2f)
                            UpdateType.WARNING -> Color(0xFFF59E0B).copy(alpha = 0.2f)
                            UpdateType.INFO -> Color(0xFF3B82F6).copy(alpha = 0.2f)
                        },
                        CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.Campaign,
                    contentDescription = null,
                    tint = when (update.type) {
                        UpdateType.EMERGENCY -> Color(0xFFDC2626)
                        UpdateType.WARNING -> Color(0xFFF59E0B)
                        UpdateType.INFO -> Color(0xFF3B82F6)
                    },
                    modifier = Modifier.size(24.dp)
                )
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = update.title,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                    Text(
                        text = update.time,
                        color = Color.Gray,
                        fontSize = 12.sp
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = update.description,
                    color = Color.Gray,
                    fontSize = 14.sp
                )
            }
        }
    }
}

private fun formatTimeAgo(timestampMs: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestampMs
    return when {
        diff < 60_000 -> "Just now"
        diff < 3600_000 -> "${diff / 60_000}m ago"
        diff < 86400_000 -> "${diff / 3600_000}h ago"
        else -> "${diff / 86400_000}d ago"
    }
}