package surf.shouldigo.app.feature.conditions.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import surf.shouldigo.app.ui.theme.*
import kotlin.math.*

private val directionDegrees = mapOf(
    "N" to 0.0, "NNE" to 22.5, "NE" to 45.0, "ENE" to 67.5,
    "E" to 90.0, "ESE" to 112.5, "SE" to 135.0, "SSE" to 157.5,
    "S" to 180.0, "SSW" to 202.5, "SW" to 225.0, "WSW" to 247.5,
    "W" to 270.0, "WNW" to 292.5, "NW" to 315.0, "NNW" to 337.5
)

private fun compassToVec(deg: Double): Offset {
    val rad = Math.toRadians(deg - 90)
    return Offset(cos(rad).toFloat(), sin(rad).toFloat())
}

private fun windRelation(waveDeg: Double, windDeg: Double): String {
    val diff = abs(((waveDeg - windDeg + 540) % 360) - 180)
    return when {
        diff < 50 -> "Onshore"
        diff > 130 -> "Offshore"
        else -> "Cross-shore"
    }
}

@Composable
fun BeachSketchView(waveDirection: String?, windDirection: String?) {
    val waveDeg = waveDirection?.let { directionDegrees[it] } ?: return
    val windDeg = windDirection?.let { directionDegrees[it] }

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = CardBackground
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            SectionHeader("Beach View")
            Spacer(modifier = Modifier.height(10.dp))

            Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
            ) {
                drawSketch(waveDeg, windDeg)
            }

            Spacer(modifier = Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(
                    text = "Swell $waveDirection",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF2563EB)
                )
                if (windDeg != null) {
                    val relation = windRelation(waveDeg, windDeg)
                    Text(
                        text = "$relation${windDirection?.let { " ($it)" } ?: ""}",
                        fontSize = 12.sp,
                        color = SecondaryText
                    )
                }
            }
        }
    }
}

private fun DrawScope.drawSketch(waveDeg: Double, windDeg: Double?) {
    val W = size.width
    val H = size.height
    val mid = Offset(W / 2, H / 2)
    val seaVec = compassToVec(waveDeg)
    val inlandVec = Offset(-seaVec.x, -seaVec.y)
    val shoreAngle = atan2(-seaVec.x.toDouble(), seaVec.y.toDouble()).toFloat()
    val shorePv = Offset(cos(shoreAngle), sin(shoreAngle))

    // Background water
    drawRect(Color(0xFFE8F5FE).copy(alpha = 0.6f))

    // Bathymetry contours
    listOf(
        Triple(32f, 105f, 0.4f),
        Triple(70f, 120f, 0.28f),
        Triple(115f, 108f, 0.18f)
    ).forEach { (dist, halfLen, opacity) ->
        drawShoreArc(mid, seaVec, dist, halfLen, shoreAngle, Color(0xFF61A5FA).copy(alpha = opacity), 1f)
    }

    // Beach shape
    val beachPath = makeBeachPath(mid, inlandVec, shorePv)
    drawPath(beachPath, Color(0xFFE6D499).copy(alpha = 0.7f))
    drawPath(beachPath, Color(0xFF8A7661), style = Stroke(width = 1.5f))

    // Foam line
    drawShoreArc(mid, seaVec, 5f, 120f, shoreAngle, Color(0xFFBFDBFF).copy(alpha = 0.7f), 4f, StrokeCap.Round)

    // Wave crest lines
    listOf(
        Triple(15f, 55f, 0.55f),
        Triple(50f, 68f, 0.45f),
        Triple(88f, 72f, 0.35f),
        Triple(130f, 65f, 0.25f),
        Triple(170f, 55f, 0.18f)
    ).forEach { (dist, halfLen, opacity) ->
        drawShoreArc(mid, seaVec, dist, halfLen, shoreAngle, Color.Blue.copy(alpha = opacity), 1.5f)
    }

    // Swell arrow (blue)
    val maxDist = maxSeawardDist(mid, seaVec, W, H)
    val wvCx = mid.x + seaVec.x * maxDist * 0.70f + shorePv.x * 30f
    val wvCy = mid.y + seaVec.y * maxDist * 0.70f + shorePv.y * 30f
    drawArrow(Offset(wvCx, wvCy), inlandVec, 44f, Color(0xFF2563EB), 2f)
    drawSmallLabel(wvCx + seaVec.x * 26f, wvCy + seaVec.y * 26f, "SWELL", Color(0xFF2563EB))

    // Wind arrow (amber, dashed)
    if (windDeg != null) {
        val windTV = compassToVec((windDeg + 180) % 360)
        val wdCx = mid.x + seaVec.x * maxDist * 0.55f + shorePv.x * (-35f)
        val wdCy = mid.y + seaVec.y * maxDist * 0.55f + shorePv.y * (-35f)
        drawArrow(Offset(wdCx, wdCy), windTV, 36f, Color(0xFFF59E0A), 1.5f, dashed = true)
        drawSmallLabel(wdCx - windTV.x * 22f, wdCy - windTV.y * 22f, "WIND", Color(0xFFF59E0A))
    }

    // Compass rose (top right)
    drawSmallLabel(W - 16f, 12f, "N", Color.Gray)
    drawLine(Color.Gray.copy(alpha = 0.6f), Offset(W - 16f, 18f), Offset(W - 16f, 27f), strokeWidth = 1.2f)
    val triPath = Path().apply {
        moveTo(W - 16f, 18f)
        lineTo(W - 19f, 24f)
        lineTo(W - 13f, 24f)
        close()
    }
    drawPath(triPath, Color.Gray.copy(alpha = 0.6f))
}

private fun DrawScope.drawShoreArc(
    mid: Offset, seaVec: Offset, dist: Float, halfLen: Float,
    shoreAngle: Float, color: Color, width: Float,
    cap: StrokeCap = StrokeCap.Butt
) {
    val cx = mid.x + seaVec.x * dist
    val cy = mid.y + seaVec.y * dist
    val pv = Offset(cos(shoreAngle), sin(shoreAngle))
    val p1 = Offset(cx - pv.x * halfLen, cy - pv.y * halfLen)
    val p2 = Offset(cx + pv.x * halfLen, cy + pv.y * halfLen)
    val cp = Offset(cx + seaVec.x * 8f, cy + seaVec.y * 8f)

    val path = Path().apply {
        moveTo(p1.x, p1.y)
        quadraticBezierTo(cp.x, cp.y, p2.x, p2.y)
    }
    drawPath(path, color, style = Stroke(width = width, cap = cap))
}

private fun makeBeachPath(mid: Offset, inlandVec: Offset, shorePv: Offset): Path {
    val cx = mid.x + inlandVec.x * 35f
    val cy = mid.y + inlandVec.y * 35f
    val halfLen = 130f
    val width = 22f

    val p1 = Offset(cx - shorePv.x * halfLen, cy - shorePv.y * halfLen)
    val p2 = Offset(cx + shorePv.x * halfLen, cy + shorePv.y * halfLen)
    val p3 = Offset(p2.x + inlandVec.x * width, p2.y + inlandVec.y * width)
    val p4 = Offset(p1.x + inlandVec.x * width, p1.y + inlandVec.y * width)

    return Path().apply {
        moveTo(p1.x, p1.y)
        lineTo(p2.x, p2.y)
        lineTo(p3.x, p3.y)
        lineTo(p4.x, p4.y)
        close()
    }
}

private fun maxSeawardDist(mid: Offset, vec: Offset, W: Float, H: Float): Float {
    val margin = 18f
    val bounds = listOfNotNull(
        if (vec.x > 0.01f) (W - margin - mid.x) / vec.x else null,
        if (vec.x < -0.01f) (margin - mid.x) / vec.x else null,
        if (vec.y > 0.01f) (H - margin - mid.y) / vec.y else null,
        if (vec.y < -0.01f) (margin - mid.y) / vec.y else null
    ).filter { it > 0 }
    return min(160f, bounds.minOrNull() ?: 160f)
}

private fun DrawScope.drawArrow(
    center: Offset, direction: Offset, length: Float,
    color: Color, lineWidth: Float, dashed: Boolean = false
) {
    val halfLen = length / 2
    val s = Offset(center.x - direction.x * halfLen, center.y - direction.y * halfLen)
    val e = Offset(center.x + direction.x * halfLen, center.y + direction.y * halfLen)

    val effect = if (dashed) PathEffect.dashPathEffect(floatArrayOf(5f, 3f)) else null
    drawLine(color, s, e, strokeWidth = lineWidth, pathEffect = effect)

    // Arrowhead
    val hw = 5f; val hl = 9f
    val pv = Offset(-direction.y, direction.x)
    val head = Path().apply {
        moveTo(e.x, e.y)
        lineTo(e.x - direction.x * hl + pv.x * hw, e.y - direction.y * hl + pv.y * hw)
        lineTo(e.x - direction.x * hl - pv.x * hw, e.y - direction.y * hl - pv.y * hw)
        close()
    }
    drawPath(head, color)
}

private fun DrawScope.drawSmallLabel(x: Float, y: Float, text: String, color: Color) {
    drawContext.canvas.nativeCanvas.drawText(
        text,
        x,
        y + 4f,
        android.graphics.Paint().apply {
            this.color = color.toArgb()
            textSize = 20f
            textAlign = android.graphics.Paint.Align.CENTER
            typeface = android.graphics.Typeface.create(android.graphics.Typeface.SERIF, android.graphics.Typeface.BOLD)
            isAntiAlias = true
        }
    )
}
