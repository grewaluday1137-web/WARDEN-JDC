package com.jdcoders.crisisconnect.screens.home

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.jdcoders.crisisconnect.CrisisConnectApp
import com.jdcoders.crisisconnect.components.AlertBar
import com.jdcoders.crisisconnect.components.BottomNavBar
import com.jdcoders.crisisconnect.map.FloorId
import com.jdcoders.crisisconnect.map.InteractiveMap
import com.jdcoders.crisisconnect.navigation.Routes
import com.jdcoders.crisisconnect.screens.profile.ProfileScreen
import com.jdcoders.crisisconnect.screens.sos.SosScreen
import com.jdcoders.crisisconnect.screens.sos.SosViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(navController: NavController) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val context = LocalContext.current
    val app = context.applicationContext as CrisisConnectApp

    // Create WardenViewModel with WebSocket service
    val wardenViewModel: WardenViewModel = viewModel(
        factory = object : androidx.lifecycle.ViewModelProvider.Factory {
            override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>): T {
                return WardenViewModel(app.webSocketService) as T
            }
        }
    )

    // Create SosViewModel
    val sosViewModel: SosViewModel = viewModel()

    var isSosSent by remember { mutableStateOf(false) }

    val triggerVibration: (Context) -> Unit = {
        val vibrator = it.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val pattern = longArrayOf(0, 200, 100, 300)
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(500)
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        text = "CRISIS CONNECT",
                        color = Color(0xFFDC2626),
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        letterSpacing = 1.sp
                    )
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color(0xFF020617)
                )
            )
        },
        bottomBar = {
            BottomNavBar(
                selectedTab = selectedTab,
                onTabSelected = { selectedTab = it }
            )
        },
        containerColor = Color(0xFF020617)
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            when (selectedTab) {
                0 -> HomeContent(navController, wardenViewModel, isSosSent)
                1 -> SosScreen(
                    isSosSent = isSosSent,
                    onSosSent = {
                        isSosSent = true
                        sosViewModel.sendSos()
                    },
                    onDeactivate = {
                        isSosSent = false
                        sosViewModel.deactivateSos()
                    },
                    triggerVibration = triggerVibration,
                    onDragStateChange = { /* Handle if needed */ }
                )
                2 -> ProfileScreen(navController)
            }
        }
    }
}

@Composable
fun HomeContent(navController: NavController, wardenViewModel: WardenViewModel, isSosSent: Boolean) {
    val context = LocalContext.current
    val alertSummary by wardenViewModel.alertSummary.collectAsState()
    val alertTitle by wardenViewModel.alertTitle.collectAsState()
    val hasActiveCrisis by wardenViewModel.hasActiveCrisis.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        AlertBar(
            title = alertTitle,
            message = alertSummary,
            hasActiveCrisis = hasActiveCrisis
        )

        CurrentLocationCard()

        FloorplanCard(wardenViewModel, isSosSent)

        SosActions(wardenViewModel, context)

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            QuickActionCard(
                modifier = Modifier.weight(1f),
                title = "WI",
                subtitle = "Warden Intelligence",
                icon = Icons.Default.Info,
                iconContainerColor = Color(0xFF1E293B),
                onClick = { navController.navigate(Routes.WARDEN_INTEL) }
            )
            QuickActionCard(
                modifier = Modifier.weight(1f),
                title = "Updates",
                subtitle = "Last: 2m ago",
                icon = Icons.Default.Campaign,
                iconContainerColor = Color(0xFF311B1B),
                onClick = { navController.navigate(Routes.UPDATES) }
            )
        }
        
        Spacer(modifier = Modifier.height(80.dp))
    }
}

@Composable
fun CurrentLocationCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.MyLocation,
                        contentDescription = null,
                        tint = Color(0xFF3B82F6),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "CURRENT LOCATION",
                        color = Color.Gray,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp
                    )
                }
                
                Surface(
                    color = Color(0xFF064E3B),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .background(Color(0xFF10B981), CircleShape)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Verified",
                            color = Color(0xFF10B981),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "Grand Hyatt",
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Room 402, 4th Floor",
                color = Color.Gray,
                fontSize = 16.sp
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.AutoMirrored.Filled.DirectionsRun,
                    contentDescription = null,
                    tint = Color.Gray,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Nearest Evacuation: ",
                    color = Color.Gray,
                    fontSize = 14.sp
                )
                Text(
                    text = "Main Lobby (Stairwell B)",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun SosActions(viewModel: WardenViewModel, context: Context) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Emergency Call Button
        Button(
            onClick = {
                val intent = Intent(Intent.ACTION_DIAL).apply {
                    data = Uri.parse("tel:112")
                }
                context.startActivity(intent)
            },
            modifier = Modifier.weight(1f).height(56.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Icon(Icons.Default.Call, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("CALL EMERGENCY", fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }

        // Share Location Button
        Button(
            onClick = { viewModel.shareLiveLocation(FloorId.GROUND) }, // Default to ground for demo
            modifier = Modifier.weight(1f).height(56.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Icon(Icons.Default.ShareLocation, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("SHARE LOCATION", fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }
    }
}

@Composable
fun FloorplanCard(wardenViewModel: WardenViewModel, isSosSent: Boolean) {
    var selectedFloor by remember { mutableStateOf(FloorId.GROUND) }

    // Reusable content for the map
    @Composable
    fun MapContent(modifier: Modifier = Modifier) {
        Box(modifier = modifier) {
            // Background grid
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.radialGradient(
                            colors = listOf(Color(0xFF1E293B), Color(0xFF0F172A))
                        )
                    )
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val strokeWidth = 1.dp.toPx()
                    val color = Color.White.copy(alpha = 0.05f)
                    for (i in 0..size.width.toInt() step 40) {
                        drawLine(color, start = androidx.compose.ui.geometry.Offset(i.toFloat(), 0f), end = androidx.compose.ui.geometry.Offset(i.toFloat(), size.height), strokeWidth = strokeWidth)
                    }
                    for (i in 0..size.height.toInt() step 40) {
                        drawLine(color, start = androidx.compose.ui.geometry.Offset(0f, i.toFloat()), end = androidx.compose.ui.geometry.Offset(size.width, i.toFloat()), strokeWidth = strokeWidth)
                    }
                }
            }

            val liveLocationNodeId by wardenViewModel.liveLocationNodeId.collectAsState()
            val floorEpicenters by wardenViewModel.floorEpicenters.collectAsState()
            
            // Extract crisis nodes for the current floor
            val crisisNodes = remember(floorEpicenters, selectedFloor) {
                val floorData = floorEpicenters[selectedFloor.key] as? Map<*, *>
                floorData?.keys?.filterIsInstance<String>()?.toSet() ?: emptySet()
            }

            // Interactive map with real nodes
            InteractiveMap(
                currentFloor = selectedFloor,
                isSosSent = isSosSent,
                crisisNodeIds = crisisNodes,
                liveLocationNodeId = liveLocationNodeId
            )

            // Labels
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(16.dp)
            ) {
                Text(
                    text = "Floor: ${selectedFloor.label}",
                    color = Color.White.copy(alpha = 0.7f),
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
            }
        }
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
        ) {
            MapContent(modifier = Modifier.fillMaxSize())
        }
        
        Spacer(modifier = Modifier.height(12.dp))
        
        // Floor selector bar
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FloorId.values().forEach { floor ->
                val isSelected = floor == selectedFloor
                Surface(
                    onClick = { selectedFloor = floor },
                    modifier = Modifier.weight(1f),
                    color = if (isSelected) Color(0xFF3B82F6) else Color(0xFF0F172A),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, if (isSelected) Color(0xFF3B82F6) else Color.White.copy(alpha = 0.1f))
                ) {
                    Text(
                        text = floor.label,
                        color = if (isSelected) Color.White else Color.Gray,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(vertical = 12.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun QuickActionCard(
    modifier: Modifier = Modifier,
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconContainerColor: Color,
    onClick: () -> Unit = {}
) {
    Card(
        modifier = modifier.height(140.dp),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)),
        onClick = onClick
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Surface(
                modifier = Modifier.size(48.dp),
                shape = CircleShape,
                color = iconContainerColor
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = if (title == "Updates") Color(0xFFDC2626) else Color(0xFF3B82F6),
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = title,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
            Text(
                text = subtitle,
                color = Color.Gray,
                fontSize = 12.sp
            )
        }
    }
}