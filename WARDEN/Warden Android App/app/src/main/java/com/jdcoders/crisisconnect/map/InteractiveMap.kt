package com.jdcoders.crisisconnect.map

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.sp

/**
 * Three-floor interactive map rendering real node infrastructure from map.json.
 * Draws nodes at anchor positions with type-based colors, connecting edges,
 * and active crisis highlighting.
 */
import androidx.compose.ui.res.imageResource
import com.jdcoders.crisisconnect.R

@OptIn(ExperimentalTextApi::class)
@Composable
fun InteractiveMap(
    currentFloor: FloorId,
    isSosSent: Boolean,
    crisisNodeIds: Set<String> = emptySet(),
    liveLocationNodeId: String? = null,
    onRoomClick: (Room) -> Unit = {}
) {
    val floorData = WardenMapData.floors[currentFloor] ?: return
    
    val floorImage = when (currentFloor) {
        FloorId.GROUND -> ImageBitmap.imageResource(id = R.drawable.floor_ground)
        FloorId.FIRST -> ImageBitmap.imageResource(id = R.drawable.floor_first)
        FloorId.SECOND -> ImageBitmap.imageResource(id = R.drawable.floor_second)
    }

    var scale by remember { mutableStateOf(1f) }
    var rotation by remember { mutableStateOf(0f) }
    var offset by remember { mutableStateOf(Offset.Zero) }

    val animatedScale by animateFloatAsState(scale, label = "scale")
    val animatedRotation by animateFloatAsState(rotation, label = "rotation")
    val animatedOffset by animateOffsetAsState(offset, label = "offset")

    // Pulse animations
    val infiniteTransition = rememberInfiniteTransition(label = "map_pulse")
    val crisisPulse by infiniteTransition.animateFloat(
        initialValue = 0.4f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1200, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "crisis_pulse_alpha"
    )
    val livePulse by infiniteTransition.animateFloat(
        initialValue = 0.5f, targetValue = 1.2f,
        animationSpec = infiniteRepeatable(tween(1500, easing = LinearOutSlowInEasing), RepeatMode.Restart),
        label = "live_pulse_scale"
    )

    val textMeasurer = rememberTextMeasurer()

    Canvas(
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTransformGestures { _, _, zoom, _ ->
                    scale = (scale * zoom).coerceIn(0.5f, 4f)
                }
            }
    ) {
        withTransform({
            translate(animatedOffset.x, animatedOffset.y)
            rotate(animatedRotation)
            scale(animatedScale, animatedScale)
        }) {
            val w = size.width
            val h = size.height

            // ── Draw Floor Image ──
            drawImage(
                image = floorImage,
                dstSize = IntSize(w.toInt(), h.toInt()),
                alpha = 0.9f
            )

            // ── Draw Edges (Pathways) ──
            // We draw paths with low opacity so they don't clutter the floorplan
            val drawnEdges = mutableSetOf<String>()
            floorData.edges.forEach { edge ->
                val edgeKey = listOf(edge.source, edge.target).sorted().joinToString("-")
                if (edgeKey in drawnEdges) return@forEach
                drawnEdges.add(edgeKey)

                val srcAnchor = WardenMapData.anchors[edge.source]
                val tgtAnchor = WardenMapData.anchors[edge.target]
                if (srcAnchor != null && tgtAnchor != null) {
                    drawLine(
                        color = Color(0xFF64748B).copy(alpha = 0.3f),
                        start = Offset(srcAnchor.x / 100f * w, srcAnchor.y / 100f * h),
                        end = Offset(tgtAnchor.x / 100f * w, tgtAnchor.y / 100f * h),
                        strokeWidth = 1.5f
                    )
                }
            }

            // ── Draw Nodes ──
            floorData.nodes.forEach { node ->
                val anchor = WardenMapData.anchors[node.id] ?: return@forEach
                val cx = anchor.x / 100f * w
                val cy = anchor.y / 100f * h

                val isCrisis = node.id in crisisNodeIds
                val isLiveLocation = node.id == liveLocationNodeId
                val isExit = node.type == "exit" || node.isExit

                // LOGIC: Hide nodes by default unless they are special
                val shouldShowNode = isCrisis || isLiveLocation || isExit || isSosSent

                if (!shouldShowNode) return@forEach

                // Node color based on state
                val nodeColor = when {
                    isCrisis -> Color(0xFFEF4444)      // Red for crisis
                    isLiveLocation -> Color(0xFF22C55E) // Green for guest
                    isExit -> Color(0xFF10B981)         // Emerald for exits
                    else -> Color(0xFF3B82F6).copy(alpha = 0.5f)
                }

                // Visual Effects (Pulses)
                if (isCrisis) {
                    drawCircle(
                        color = nodeColor.copy(alpha = crisisPulse * 0.4f),
                        radius = 24f,
                        center = Offset(cx, cy)
                    )
                }
                
                if (isLiveLocation) {
                    drawCircle(
                        color = nodeColor.copy(alpha = 0.4f),
                        radius = 20f * livePulse,
                        center = Offset(cx, cy),
                        style = Stroke(width = 4f)
                    )
                }

                // Draw the node shape
                if (isExit) {
                    drawRoundRect(
                        color = nodeColor,
                        topLeft = Offset(cx - 12f, cy - 8f),
                        size = Size(24f, 16f),
                        cornerRadius = CornerRadius(4f)
                    )
                } else {
                    drawCircle(
                        color = nodeColor,
                        radius = if (isLiveLocation) 10f else 8f,
                        center = Offset(cx, cy)
                    )
                    if (isLiveLocation || isCrisis) {
                        drawCircle(
                            color = Color.White,
                            radius = 4f,
                            center = Offset(cx, cy)
                        )
                    }
                }

                // Labels for visible nodes
                val labelText = if (isLiveLocation) "YOUR LOCATION" else node.zoneType.replace("_", " ").uppercase()
                val textResult = textMeasurer.measure(
                    AnnotatedString(labelText),
                    style = TextStyle(
                        fontSize = 8.sp,
                        fontWeight = if (isLiveLocation || isCrisis) FontWeight.Bold else FontWeight.Medium,
                        color = if (isLiveLocation) Color(0xFF22C55E) else if (isCrisis) Color(0xFFEF4444) else Color.White
                    )
                )
                drawText(
                    textLayoutResult = textResult,
                    topLeft = Offset(cx - textResult.size.width / 2f, cy + 14f)
                )
            }
        }
    }
}