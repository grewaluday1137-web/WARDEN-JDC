package com.jdcoders.crisisconnect.screens.splash

import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import androidx.navigation.NavController
import kotlinx.coroutines.delay
import android.content.Context
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.jdcoders.crisisconnect.R
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.graphicsLayer
import com.jdcoders.crisisconnect.navigation.Routes
import com.jdcoders.crisisconnect.utils.areAllPermissionsGranted

@Composable
fun SplashScreen(navController: NavController) {

    val context = LocalContext.current

    // 🔥 ANIMATION STATES
    var startAnim by remember { mutableStateOf(false) }

    val alphaAnim by animateFloatAsState(
        targetValue = if (startAnim) 1f else 0f,
        animationSpec = tween(800),
        label = ""
    )

    val scaleAnim by animateFloatAsState(
        targetValue = if (startAnim) 1f else 0.85f,
        animationSpec = tween(800),
        label = ""
    )

    LaunchedEffect(Unit) {

        startAnim = true

        delay(1500)

        when {

            !areAllPermissionsGranted(context) -> {
                navController.navigate("permissions") {
                    popUpTo(Routes.SPLASH) { inclusive = true }
                }
            }

            else -> {
                // Navigate to Guest Login (Combined Detail + OTP)
                navController.navigate(Routes.OTP_LOGIN) {
                    popUpTo(Routes.SPLASH) { inclusive = true }
                }
            }
        }
    }

    // 🔥 MATCH PERMISSION SCREEN GRADIENT
    val background = Brush.verticalGradient(
        listOf(
            Color(0xFF07121C),
            Color(0xFF0E2436)
        )
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(background)
    ) {

        // 🔥 TOP LIGHT GLOW (DEPTH)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            Color(0xFF00D4EC).copy(alpha = 0.15f), // subtle cyan glow
                            Color.Transparent
                        ),
                        radius = 900f
                    )
                )
        )

        // 🔥 YOUR EXISTING CONTENT (KEEP SAME)
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .alpha(alphaAnim)
                .graphicsLayer {
                    scaleX = scaleAnim
                    scaleY = scaleAnim
                },
            verticalArrangement = Arrangement.Center
        ) {

            Image(
                painter = painterResource(id = R.drawable.logo),
                contentDescription = "App Logo",
                modifier = Modifier.size(120.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "WARDEN",
                color = Color.White,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = "Stay Safe",
                color = Color.Gray
            )
        }
    }
}