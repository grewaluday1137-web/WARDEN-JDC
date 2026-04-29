package com.jdcoders.crisisconnect.screens.sos

import android.content.Context
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

@Composable
fun SosScreen(
    isSosSent: Boolean,
    onSosSent: () -> Unit,
    onDeactivate: () -> Unit,
    triggerVibration: (Context) -> Unit,
    onDragStateChange: (Boolean) -> Unit
) {
    AnimatedContent(
        targetState = isSosSent,
        transitionSpec = {
            fadeIn(animationSpec = tween(500)) + scaleIn(initialScale = 0.9f) togetherWith 
            fadeOut(animationSpec = tween(500)) + scaleOut(targetScale = 1.1f)
        },
        label = "SosContentTransition"
    ) { sent ->
        if (sent) {
            SosActiveContent(onDeactivate = onDeactivate)
        } else {
            SosStandbyContent(
                onSosSent = onSosSent, 
                triggerVibration = triggerVibration, 
                onDragStateChange = onDragStateChange
            )
        }
    }
}

@Composable
fun SosStandbyContent(
    onSosSent: () -> Unit,
    triggerVibration: (Context) -> Unit,
    onDragStateChange: (Boolean) -> Unit
) {
    val context = LocalContext.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(32.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A).copy(alpha = 0.8f)),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Surface(
                    modifier = Modifier.size(80.dp),
                    shape = CircleShape,
                    color = Color(0xFFDC2626).copy(alpha = 0.1f)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Surface(
                            modifier = Modifier.size(56.dp),
                            shape = CircleShape,
                            color = Color(0xFFDC2626).copy(alpha = 0.2f)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.Warning,
                                    contentDescription = null,
                                    tint = Color(0xFFDC2626),
                                    modifier = Modifier.size(32.dp)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = "Emergency Standby",
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "Triggering an SOS will instantly broadcast your live location and critical health data to chosen contacts and authorities.",
                    color = Color.Gray,
                    fontSize = 15.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 22.sp
                )
            }
        }

        Button(
            onClick = { /* TODO */ },
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
            shape = RoundedCornerShape(20.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Phone, contentDescription = null, tint = Color.White)
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = "Call Emergency Services",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        SosSlider(
            onCompleted = {
                triggerVibration(context)
                onSosSent()
            },
            onDragStateChange = onDragStateChange
        )

        Spacer(modifier = Modifier.height(40.dp))
    }
}

@Composable
fun SosActiveContent(onDeactivate: () -> Unit) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.3f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseScale"
    )
    
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.6f,
        targetValue = 0.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseAlpha"
    )

    var secondsElapsed by remember { mutableIntStateOf(0) }
    var isRecording by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            secondsElapsed++
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(160.dp)) {
            Box(
                modifier = Modifier
                    .size(140.dp)
                    .scale(scale)
                    .clip(CircleShape)
                    .background(Color(0xFFDC2626).copy(alpha = alpha))
            )
            
            Surface(
                modifier = Modifier.size(80.dp),
                shape = CircleShape,
                color = Color(0xFFDC2626),
                shadowElevation = 8.dp
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Default.GppBad,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(40.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "SOS SIGNAL ACTIVE",
            color = Color(0xFFDC2626),
            fontSize = 24.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 1.sp
        )

        Text(
            text = "Time Active: ${String.format("%02d:%02d", secondsElapsed / 60, secondsElapsed % 60)}",
            color = Color.Gray,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium
        )

        Spacer(modifier = Modifier.height(32.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            shape = RoundedCornerShape(24.dp),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
        ) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                StatusItem("Live Location Sent", true)
                StatusItem("Emergency Network Broadcasting", true)
                StatusItem("First Responders Alerted", secondsElapsed > 5)
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = { isRecording = !isRecording },
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (isRecording) Color(0xFFDC2626) else Color(0xFF1E293B)
            ),
            shape = RoundedCornerShape(20.dp),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (isRecording) Icons.Default.Mic else Icons.Default.MicNone,
                    contentDescription = null,
                    tint = Color.White
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = if (isRecording) "RECORDING AUDIO..." else "SEND AUDIO RECORDING",
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = onDeactivate,
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.05f)),
            shape = RoundedCornerShape(20.dp),
            border = BorderStroke(2.dp, Color.White.copy(alpha = 0.2f))
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Stop, contentDescription = null, tint = Color.White)
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = "DEACTIVATE SOS",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            }
        }
        
        Spacer(modifier = Modifier.height(40.dp))
    }
}

@Composable
fun StatusItem(text: String, completed: Boolean) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        if (completed) {
            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(20.dp))
        } else {
            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color(0xFF3B82F6))
        }
        Spacer(modifier = Modifier.width(12.dp))
        Text(text = text, color = if (completed) Color.White else Color.Gray, fontSize = 14.sp)
    }
}

@Composable
fun SosSlider(
    onCompleted: () -> Unit,
    onDragStateChange: (Boolean) -> Unit
) {
    val density = LocalDensity.current
    var trackWidthPx by remember { mutableFloatStateOf(0f) }
    var dragOffset by remember { mutableFloatStateOf(0f) }
    var isDragging by remember { mutableStateOf(false) }
    var isActivating by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    
    val handleSize = 56.dp
    val handlePx = with(density) { handleSize.toPx() }
    val trackPadding = with(density) { 8.dp.toPx() }
    
    val maxDrag = (trackWidthPx - handlePx - (trackPadding * 2)).coerceAtLeast(0f)
    
    val animatedDragOffset by animateFloatAsState(
        targetValue = dragOffset,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = if (isDragging) 1000f else Spring.StiffnessLow
        ),
        label = "dragOffset"
    )

    val progress = if (maxDrag > 0f) animatedDragOffset / maxDrag else 0f
    
    val trackBackgroundColor by animateColorAsState(
        targetValue = if (isActivating) Color(0xFFDC2626) else Color(0xFF1E293B),
        animationSpec = tween(400),
        label = "trackBackgroundColor"
    )

    Box(
        modifier = Modifier
            .width(280.dp)
            .height(72.dp)
            .clip(RoundedCornerShape(50.dp))
            .background(trackBackgroundColor)
            .onGloballyPositioned {
                trackWidthPx = it.size.width.toFloat()
            }
            .pointerInput(maxDrag, isActivating) {
                if (maxDrag <= 0f || isActivating) return@pointerInput
                detectHorizontalDragGestures(
                    onDragStart = { 
                        isDragging = true
                        onDragStateChange(true) 
                    },
                    onDragEnd = {
                        isDragging = false
                        onDragStateChange(false)
                        if (dragOffset > maxDrag * 0.8f) {
                            dragOffset = maxDrag
                            isActivating = true
                            scope.launch {
                                delay(400)
                                onCompleted()
                            }
                        } else {
                            dragOffset = 0f
                        }
                    },
                    onDragCancel = {
                        isDragging = false
                        onDragStateChange(false)
                        dragOffset = 0f
                    }
                ) { change, dragAmount ->
                    change.consume()
                    dragOffset = (dragOffset + dragAmount).coerceIn(0f, maxDrag)
                }
            },
        contentAlignment = Alignment.CenterStart
    ) {
        // Text that fades out
        Text(
            text = "SOS",
            modifier = Modifier
                .fillMaxWidth()
                .alpha(1f - (progress * 2f).coerceIn(0f, 1f)),
            textAlign = TextAlign.Center,
            color = Color.White.copy(alpha = 0.3f),
            fontSize = 18.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 4.sp
        )

        // The Handle (Circle)
        Box(
            modifier = Modifier
                .padding(horizontal = 8.dp)
                .offset { 
                    IntOffset(animatedDragOffset.roundToInt(), 0) 
                }
                .size(if (isActivating) 64.dp else 56.dp)
                .shadow(
                    elevation = if (isDragging) 8.dp else 4.dp,
                    shape = CircleShape
                )
                .clip(CircleShape)
                .background(Color.White)
                .animateContentSize(
                    animationSpec = spring(
                        dampingRatio = Spring.DampingRatioMediumBouncy,
                        stiffness = Spring.StiffnessLow
                    )
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = if (isActivating) Icons.Default.GppBad else Icons.Default.KeyboardDoubleArrowRight,
                contentDescription = null,
                tint = if (isActivating) Color(0xFFDC2626) else Color(0xFF1E293B),
                modifier = Modifier.size(32.dp)
            )
        }
    }
}