package com.jdcoders.crisisconnect.map

import androidx.compose.ui.geometry.Offset

/**
 * Complete map data for all 3 floors, mirroring the backend's map.json.
 * Each node has a position (as %) and metadata for rendering.
 */

data class MapNode(
    val id: String,
    val type: String,        // "open_area", "exit", "vertical", "service", "room", "corridor", "junction", etc.
    val zoneType: String,    // "lobby", "kitchen", "stairs_left", etc.
    val capacity: Int,
    val floor: String,
    val tags: List<String> = emptyList(),
    val verticalGroup: String? = null,
    val isEntry: Boolean = false,
    val isExit: Boolean = false
)

data class MapEdge(
    val source: String,
    val target: String,
    val weight: Int = 1
)

data class FloorData(
    val nodes: List<MapNode>,
    val edges: List<MapEdge>
)

data class Anchor(
    val x: Float,
    val y: Float
) {
    fun toOffset() = Offset(x, y)
}

enum class FloorId(val label: String, val key: String) {
    GROUND("Ground", "F1_GROUND"),
    FIRST("1st Floor", "F2_FIRST"),
    SECOND("2nd Floor", "F3_SECOND")
}

/**
 * All map data embedded from the backend's map.json
 */
object WardenMapData {

    // ── Anchors (x%, y% positions for rendering) ──
    val anchors: Map<String, Anchor> = mapOf(
        // Floor 1 - Ground
        "F1_GROUND_N1"  to Anchor(50f, 40f),
        "F1_GROUND_N2"  to Anchor(50f, 46f),
        "F1_GROUND_N3"  to Anchor(50f, 35f),
        "F1_GROUND_N4"  to Anchor(38f, 42f),
        "F1_GROUND_N5"  to Anchor(62f, 42f),
        "F1_GROUND_N6"  to Anchor(50f, 55f),
        "F1_GROUND_N10" to Anchor(25f, 45f),
        "F1_GROUND_N11" to Anchor(25f, 35f),
        "F1_GROUND_N12" to Anchor(15f, 25f),
        "F1_GROUND_N20" to Anchor(75f, 35f),
        "F1_GROUND_N21" to Anchor(75f, 45f),
        "F1_GROUND_N30" to Anchor(75f, 15f),
        "F1_GROUND_N31" to Anchor(85f, 15f),
        "F1_GROUND_N32" to Anchor(65f, 15f),
        "F1_GROUND_N33" to Anchor(35f, 15f),
        "F1_GROUND_N34" to Anchor(30f, 15f),
        "F1_GROUND_N35" to Anchor(25f, 15f),
        "F1_GROUND_N40" to Anchor(20f, 60f),
        "F1_GROUND_N41" to Anchor(35f, 60f),
        "F1_GROUND_N42" to Anchor(60f, 60f),
        "F1_GROUND_N43" to Anchor(70f, 60f),
        "F1_GROUND_N44" to Anchor(78f, 60f),
        "F1_GROUND_N45" to Anchor(85f, 60f),
        "F1_GROUND_N50" to Anchor(40f, 30f),
        "F1_GROUND_N51" to Anchor(60f, 30f),
        "F1_GROUND_N52" to Anchor(50f, 20f),
        "F1_GROUND_N53" to Anchor(65f, 20f),
        // Floor 2 - First
        "F2_FIRST_N1"   to Anchor(20f, 20f),
        "F2_FIRST_N2"   to Anchor(60f, 20f),
        "F2_FIRST_N3"   to Anchor(40f, 40f),
        "F2_FIRST_N4"   to Anchor(20f, 60f),
        "F2_FIRST_N5"   to Anchor(60f, 60f),
        "F2_FIRST_N6"   to Anchor(40f, 80f),
        "F2_FIRST_N7"   to Anchor(80f, 40f),
        "F2_FIRST_N8"   to Anchor(92f, 20f),
        // Floor 3 - Second
        "F3_SECOND_N1"  to Anchor(24f, 18f),
        "F3_SECOND_N2"  to Anchor(60f, 18f),
        "F3_SECOND_N3"  to Anchor(88f, 18f),
        "F3_SECOND_N4"  to Anchor(60f, 40f),
        "F3_SECOND_N5"  to Anchor(24f, 64f),
        "F3_SECOND_N6"  to Anchor(88f, 64f),
        "F3_SECOND_N7"  to Anchor(88f, 40f),
        "F3_SECOND_N8"  to Anchor(88f, 18f),
        "F3_SECOND_N9"  to Anchor(60f, 80f)
    )

    // ── Floor 1: Ground ──
    private val groundNodes = listOf(
        MapNode("F1_GROUND_N1", "open_area", "lobby", 50, "F1_GROUND"),
        MapNode("F1_GROUND_N2", "open_area", "reception", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N3", "junction", "lobby", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N4", "open_area", "lobby_left", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N5", "open_area", "lobby_right", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N6", "exit", "main_entrance", 20, "F1_GROUND", tags = listOf("metal_detector", "security_checkpoint", "main_entrance"), isEntry = true, isExit = true),
        MapNode("F1_GROUND_N10", "open_area", "restaurant", 80, "F1_GROUND"),
        MapNode("F1_GROUND_N11", "open_area", "bar", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N12", "open_area", "cafe", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N20", "open_area", "ballroom", 120, "F1_GROUND"),
        MapNode("F1_GROUND_N21", "open_area", "pre_function", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N30", "service", "kitchen", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N31", "service", "prep_kitchen", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N32", "service", "dry_store", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N33", "service", "staff_lounge", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N34", "service", "staff_toilet", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N35", "service", "staff_locker", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N40", "service", "receiving", 20, "F1_GROUND", tags = listOf("metal_detector", "security_checkpoint", "service_entrance"), isEntry = true),
        MapNode("F1_GROUND_N41", "service", "linen", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N42", "service", "housekeeping", 20, "F1_GROUND", tags = listOf("metal_detector", "security_checkpoint", "service_entrance"), isEntry = true),
        MapNode("F1_GROUND_N43", "service", "engineering", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N44", "service", "security", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N45", "service", "admin", 20, "F1_GROUND"),
        MapNode("F1_GROUND_N50", "vertical", "stairs_left", 20, "F1_GROUND", verticalGroup = "STAIR_A"),
        MapNode("F1_GROUND_N51", "vertical", "stairs_right", 20, "F1_GROUND", verticalGroup = "STAIR_B"),
        MapNode("F1_GROUND_N52", "vertical", "lift_main", 20, "F1_GROUND", verticalGroup = "ELEVATOR_MAIN"),
        MapNode("F1_GROUND_N53", "vertical", "service_lift", 20, "F1_GROUND", verticalGroup = "ELEVATOR_SERVICE")
    )

    private val groundEdges = listOf(
        MapEdge("F1_GROUND_N6", "F1_GROUND_N2"), MapEdge("F1_GROUND_N2", "F1_GROUND_N6"),
        MapEdge("F1_GROUND_N2", "F1_GROUND_N1"), MapEdge("F1_GROUND_N1", "F1_GROUND_N2"),
        MapEdge("F1_GROUND_N1", "F1_GROUND_N3"), MapEdge("F1_GROUND_N3", "F1_GROUND_N1"),
        MapEdge("F1_GROUND_N3", "F1_GROUND_N4"), MapEdge("F1_GROUND_N4", "F1_GROUND_N3"),
        MapEdge("F1_GROUND_N3", "F1_GROUND_N5"), MapEdge("F1_GROUND_N5", "F1_GROUND_N3"),
        MapEdge("F1_GROUND_N4", "F1_GROUND_N10"), MapEdge("F1_GROUND_N10", "F1_GROUND_N4"),
        MapEdge("F1_GROUND_N10", "F1_GROUND_N11"), MapEdge("F1_GROUND_N11", "F1_GROUND_N10"),
        MapEdge("F1_GROUND_N11", "F1_GROUND_N12"), MapEdge("F1_GROUND_N12", "F1_GROUND_N11"),
        MapEdge("F1_GROUND_N5", "F1_GROUND_N20"), MapEdge("F1_GROUND_N20", "F1_GROUND_N5"),
        MapEdge("F1_GROUND_N20", "F1_GROUND_N21"), MapEdge("F1_GROUND_N21", "F1_GROUND_N20"),
        MapEdge("F1_GROUND_N3", "F1_GROUND_N50"), MapEdge("F1_GROUND_N50", "F1_GROUND_N3"),
        MapEdge("F1_GROUND_N3", "F1_GROUND_N51"), MapEdge("F1_GROUND_N51", "F1_GROUND_N3"),
        MapEdge("F1_GROUND_N3", "F1_GROUND_N52"), MapEdge("F1_GROUND_N52", "F1_GROUND_N3"),
        MapEdge("F1_GROUND_N52", "F1_GROUND_N30"), MapEdge("F1_GROUND_N30", "F1_GROUND_N52"),
        MapEdge("F1_GROUND_N30", "F1_GROUND_N31"), MapEdge("F1_GROUND_N31", "F1_GROUND_N30"),
        MapEdge("F1_GROUND_N30", "F1_GROUND_N32"), MapEdge("F1_GROUND_N32", "F1_GROUND_N30"),
        MapEdge("F1_GROUND_N33", "F1_GROUND_N3"), MapEdge("F1_GROUND_N3", "F1_GROUND_N33"),
        MapEdge("F1_GROUND_N40", "F1_GROUND_N6"), MapEdge("F1_GROUND_N6", "F1_GROUND_N40"),
        MapEdge("F1_GROUND_N42", "F1_GROUND_N6"), MapEdge("F1_GROUND_N6", "F1_GROUND_N42")
    )

    // ── Floor 2: First ──
    private val firstNodes = listOf(
        MapNode("F2_FIRST_N1", "room", "private", 40, "F2_FIRST"),
        MapNode("F2_FIRST_N2", "room", "private", 40, "F2_FIRST"),
        MapNode("F2_FIRST_N3", "corridor", "corridor", 100, "F2_FIRST"),
        MapNode("F2_FIRST_N4", "stairs", "public", 50, "F2_FIRST", verticalGroup = "STAIR_A"),
        MapNode("F2_FIRST_N5", "stairs", "public", 50, "F2_FIRST", verticalGroup = "STAIR_B"),
        MapNode("F2_FIRST_N6", "exit", "public", 200, "F2_FIRST"),
        MapNode("F2_FIRST_N7", "washroom", "public", 20, "F2_FIRST"),
        MapNode("F2_FIRST_N8", "office", "private", 15, "F2_FIRST")
    )

    private val firstEdges = listOf(
        MapEdge("F2_FIRST_N1", "F2_FIRST_N3"), MapEdge("F2_FIRST_N3", "F2_FIRST_N1"),
        MapEdge("F2_FIRST_N2", "F2_FIRST_N3"), MapEdge("F2_FIRST_N3", "F2_FIRST_N2"),
        MapEdge("F2_FIRST_N3", "F2_FIRST_N4"), MapEdge("F2_FIRST_N4", "F2_FIRST_N3"),
        MapEdge("F2_FIRST_N3", "F2_FIRST_N5"), MapEdge("F2_FIRST_N5", "F2_FIRST_N3"),
        MapEdge("F2_FIRST_N4", "F2_FIRST_N6"), MapEdge("F2_FIRST_N6", "F2_FIRST_N4"),
        MapEdge("F2_FIRST_N5", "F2_FIRST_N6"), MapEdge("F2_FIRST_N6", "F2_FIRST_N5"),
        MapEdge("F2_FIRST_N3", "F2_FIRST_N7"), MapEdge("F2_FIRST_N7", "F2_FIRST_N3"),
        MapEdge("F2_FIRST_N7", "F2_FIRST_N8"), MapEdge("F2_FIRST_N8", "F2_FIRST_N7")
    )

    // ── Floor 3: Second ──
    private val secondNodes = listOf(
        MapNode("F3_SECOND_N1", "room", "private", 40, "F3_SECOND"),
        MapNode("F3_SECOND_N2", "room", "private", 40, "F3_SECOND"),
        MapNode("F3_SECOND_N3", "lab", "private", 50, "F3_SECOND"),
        MapNode("F3_SECOND_N4", "corridor", "private", 120, "F3_SECOND"),
        MapNode("F3_SECOND_N5", "stairs", "private", 50, "F3_SECOND", verticalGroup = "STAIR_A"),
        MapNode("F3_SECOND_N6", "stairs", "private", 50, "F3_SECOND", verticalGroup = "STAIR_B"),
        MapNode("F3_SECOND_N7", "washroom", "private", 20, "F3_SECOND"),
        MapNode("F3_SECOND_N8", "office", "private", 15, "F3_SECOND"),
        MapNode("F3_SECOND_N9", "exit", "private", 200, "F3_SECOND")
    )

    private val secondEdges = listOf(
        MapEdge("F3_SECOND_N1", "F3_SECOND_N4"), MapEdge("F3_SECOND_N4", "F3_SECOND_N1"),
        MapEdge("F3_SECOND_N2", "F3_SECOND_N4"), MapEdge("F3_SECOND_N4", "F3_SECOND_N2"),
        MapEdge("F3_SECOND_N3", "F3_SECOND_N4"), MapEdge("F3_SECOND_N4", "F3_SECOND_N3"),
        MapEdge("F3_SECOND_N4", "F3_SECOND_N5"), MapEdge("F3_SECOND_N5", "F3_SECOND_N4"),
        MapEdge("F3_SECOND_N4", "F3_SECOND_N6"), MapEdge("F3_SECOND_N6", "F3_SECOND_N4"),
        MapEdge("F3_SECOND_N5", "F3_SECOND_N9"), MapEdge("F3_SECOND_N9", "F3_SECOND_N5"),
        MapEdge("F3_SECOND_N6", "F3_SECOND_N9"), MapEdge("F3_SECOND_N9", "F3_SECOND_N6"),
        MapEdge("F3_SECOND_N4", "F3_SECOND_N7"), MapEdge("F3_SECOND_N7", "F3_SECOND_N4"),
        MapEdge("F3_SECOND_N7", "F3_SECOND_N8"), MapEdge("F3_SECOND_N8", "F3_SECOND_N7")
    )

    val floors: Map<FloorId, FloorData> = mapOf(
        FloorId.GROUND to FloorData(groundNodes, groundEdges),
        FloorId.FIRST  to FloorData(firstNodes, firstEdges),
        FloorId.SECOND to FloorData(secondNodes, secondEdges)
    )
}
