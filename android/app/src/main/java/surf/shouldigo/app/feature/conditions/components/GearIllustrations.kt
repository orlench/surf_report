package surf.shouldigo.app.feature.conditions.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

private val BoardBlue = Color(0xFF3B82F6)
private val BoardBlueDark = Color(0xFF2563EB)
private val BoardBlueLight = Color(0xFF60A5FA)
private val FinColor = Color(0xFF3B82F6).copy(alpha = 0.5f)

@Composable
fun BoardIllustration(boardType: String, modifier: Modifier = Modifier.size(28.dp, 64.dp)) {
    Canvas(modifier = modifier) {
        when (boardType) {
            "longboard" -> drawLongboard()
            "fish" -> drawFish()
            "midlength" -> drawMidlength()
            "shortboard" -> drawShortboard()
            "stepup" -> drawStepup()
            "gun" -> drawGun()
            "sup" -> drawSUP()
            else -> drawMidlength()
        }
    }
}

@Composable
fun WetsuitIllustration(isShorts: Boolean, modifier: Modifier = Modifier.size(36.dp, 64.dp)) {
    Canvas(modifier = modifier) {
        if (isShorts) drawBoardshorts() else drawWetsuit()
    }
}

// --- Board drawings (top-down view, matching web SVGs) ---

private fun DrawScope.drawLongboard() {
    val w = size.width; val h = size.height
    val path = Path().apply {
        moveTo(w * 0.5f, h * 0.01f)
        cubicTo(w * 0.75f, h * 0.01f, w * 0.9f, h * 0.05f, w * 0.92f, h * 0.17f)
        lineTo(w * 0.93f, h * 0.44f)
        quadraticTo(w * 0.93f, h * 0.65f, w * 0.92f, h * 0.78f)
        cubicTo(w * 0.9f, h * 0.88f, w * 0.78f, h * 0.95f, w * 0.7f, h * 0.97f)
        lineTo(w * 0.5f, h * 0.99f)
        lineTo(w * 0.3f, h * 0.97f)
        cubicTo(w * 0.22f, h * 0.95f, w * 0.1f, h * 0.88f, w * 0.08f, h * 0.78f)
        quadraticTo(w * 0.07f, h * 0.65f, w * 0.07f, h * 0.44f)
        lineTo(w * 0.08f, h * 0.17f)
        cubicTo(w * 0.1f, h * 0.05f, w * 0.25f, h * 0.01f, w * 0.5f, h * 0.01f)
        close()
    }
    drawPath(path, BoardBlue.copy(alpha = 0.85f))
    drawPath(path, BoardBlueDark, style = Stroke(width = 0.8f))
    // Stringer
    drawLine(Color.Black.copy(alpha = 0.12f), Offset(w * 0.5f, h * 0.04f), Offset(w * 0.5f, h * 0.97f), strokeWidth = 0.8f)
    // Nose concave
    drawOval(Color.Black.copy(alpha = 0.05f), Offset(w * 0.3f, h * 0.08f), Size(w * 0.4f, h * 0.03f), style = Stroke(0.5f))
    // Single fin
    val fin = Path().apply {
        moveTo(w * 0.5f, h * 0.88f)
        lineTo(w * 0.4f, h * 0.95f)
        quadraticTo(w * 0.5f, h * 0.97f, w * 0.6f, h * 0.95f)
        close()
    }
    drawPath(fin, FinColor)
}

private fun DrawScope.drawFish() {
    val w = size.width; val h = size.height
    val path = Path().apply {
        moveTo(w * 0.5f, h * 0.02f)
        cubicTo(w * 0.72f, h * 0.02f, w * 0.92f, h * 0.08f, w * 0.95f, h * 0.2f)
        lineTo(w * 0.96f, h * 0.42f)
        quadraticTo(w * 0.96f, h * 0.62f, w * 0.92f, h * 0.76f)
        cubicTo(w * 0.88f, h * 0.84f, w * 0.78f, h * 0.9f, w * 0.68f, h * 0.94f)
        // Swallowtail
        lineTo(w * 0.62f, h * 0.98f)
        quadraticTo(w * 0.56f, h * 0.94f, w * 0.5f, h * 0.98f)
        quadraticTo(w * 0.44f, h * 0.94f, w * 0.38f, h * 0.98f)
        lineTo(w * 0.32f, h * 0.94f)
        cubicTo(w * 0.22f, h * 0.9f, w * 0.12f, h * 0.84f, w * 0.08f, h * 0.76f)
        quadraticTo(w * 0.04f, h * 0.62f, w * 0.04f, h * 0.42f)
        lineTo(w * 0.05f, h * 0.2f)
        cubicTo(w * 0.08f, h * 0.08f, w * 0.28f, h * 0.02f, w * 0.5f, h * 0.02f)
        close()
    }
    drawPath(path, BoardBlue.copy(alpha = 0.85f))
    drawPath(path, BoardBlueDark, style = Stroke(width = 0.8f))
    drawLine(Color.Black.copy(alpha = 0.12f), Offset(w * 0.5f, h * 0.05f), Offset(w * 0.5f, h * 0.96f), strokeWidth = 0.8f)
    // Twin keel fins
    val finL = Path().apply {
        moveTo(w * 0.28f, h * 0.78f); lineTo(w * 0.18f, h * 0.88f); quadraticTo(w * 0.24f, h * 0.91f, w * 0.32f, h * 0.86f); close()
    }
    val finR = Path().apply {
        moveTo(w * 0.72f, h * 0.78f); lineTo(w * 0.82f, h * 0.88f); quadraticTo(w * 0.76f, h * 0.91f, w * 0.68f, h * 0.86f); close()
    }
    drawPath(finL, FinColor)
    drawPath(finR, FinColor)
}

private fun DrawScope.drawMidlength() {
    val w = size.width; val h = size.height
    val path = Path().apply {
        moveTo(w * 0.5f, h * 0.02f)
        cubicTo(w * 0.72f, h * 0.02f, w * 0.88f, h * 0.07f, w * 0.9f, h * 0.18f)
        lineTo(w * 0.92f, h * 0.43f)
        quadraticTo(w * 0.92f, h * 0.65f, w * 0.88f, h * 0.79f)
        cubicTo(w * 0.85f, h * 0.88f, w * 0.72f, h * 0.94f, w * 0.62f, h * 0.96f)
        quadraticTo(w * 0.5f, h * 0.99f, w * 0.38f, h * 0.96f)
        cubicTo(w * 0.28f, h * 0.94f, w * 0.15f, h * 0.88f, w * 0.12f, h * 0.79f)
        quadraticTo(w * 0.08f, h * 0.65f, w * 0.08f, h * 0.43f)
        lineTo(w * 0.1f, h * 0.18f)
        cubicTo(w * 0.12f, h * 0.07f, w * 0.28f, h * 0.02f, w * 0.5f, h * 0.02f)
        close()
    }
    drawPath(path, BoardBlue.copy(alpha = 0.85f))
    drawPath(path, BoardBlueDark, style = Stroke(width = 0.8f))
    drawLine(Color.Black.copy(alpha = 0.12f), Offset(w * 0.5f, h * 0.05f), Offset(w * 0.5f, h * 0.95f), strokeWidth = 0.8f)
    // 2+1 fins
    drawFin(w * 0.5f, h * 0.86f, w * 0.45f, h * 0.93f, w * 0.55f, h * 0.93f)
    drawFin(w * 0.28f, h * 0.84f, w * 0.22f, h * 0.89f, w * 0.34f, h * 0.88f)
    drawFin(w * 0.72f, h * 0.84f, w * 0.78f, h * 0.89f, w * 0.66f, h * 0.88f)
}

private fun DrawScope.drawShortboard() {
    val w = size.width; val h = size.height
    // Pointed nose, narrower
    val path = Path().apply {
        moveTo(w * 0.5f, h * 0.005f)
        cubicTo(w * 0.58f, h * 0.02f, w * 0.82f, h * 0.1f, w * 0.86f, h * 0.22f)
        lineTo(w * 0.88f, h * 0.42f)
        quadraticTo(w * 0.88f, h * 0.64f, w * 0.85f, h * 0.78f)
        cubicTo(w * 0.82f, h * 0.86f, w * 0.72f, h * 0.92f, w * 0.62f, h * 0.95f)
        lineTo(w * 0.56f, h * 0.97f)
        quadraticTo(w * 0.5f, h * 0.98f, w * 0.44f, h * 0.97f)
        lineTo(w * 0.38f, h * 0.95f)
        cubicTo(w * 0.28f, h * 0.92f, w * 0.18f, h * 0.86f, w * 0.15f, h * 0.78f)
        quadraticTo(w * 0.12f, h * 0.64f, w * 0.12f, h * 0.42f)
        lineTo(w * 0.14f, h * 0.22f)
        cubicTo(w * 0.18f, h * 0.1f, w * 0.42f, h * 0.02f, w * 0.5f, h * 0.005f)
        close()
    }
    drawPath(path, BoardBlue.copy(alpha = 0.85f))
    drawPath(path, BoardBlueDark, style = Stroke(width = 0.8f))
    drawLine(Color.Black.copy(alpha = 0.12f), Offset(w * 0.5f, h * 0.03f), Offset(w * 0.5f, h * 0.95f), strokeWidth = 0.8f)
    // Nose rocker hint
    drawArc(Color.Black.copy(alpha = 0.05f), 200f, 140f, false,
        Offset(w * 0.35f, h * 0.02f), Size(w * 0.3f, h * 0.04f), style = Stroke(0.5f))
    // Thruster fins
    drawFin(w * 0.5f, h * 0.84f, w * 0.44f, h * 0.92f, w * 0.56f, h * 0.92f)
    drawFin(w * 0.25f, h * 0.81f, w * 0.18f, h * 0.87f, w * 0.3f, h * 0.86f)
    drawFin(w * 0.75f, h * 0.81f, w * 0.82f, h * 0.87f, w * 0.7f, h * 0.86f)
}

private fun DrawScope.drawStepup() {
    val w = size.width; val h = size.height
    val path = Path().apply {
        moveTo(w * 0.5f, h * 0.005f)
        cubicTo(w * 0.6f, h * 0.02f, w * 0.84f, h * 0.1f, w * 0.88f, h * 0.22f)
        lineTo(w * 0.9f, h * 0.44f)
        quadraticTo(w * 0.9f, h * 0.66f, w * 0.86f, h * 0.79f)
        cubicTo(w * 0.82f, h * 0.87f, w * 0.68f, h * 0.93f, w * 0.58f, h * 0.97f)
        lineTo(w * 0.5f, h * 0.99f)
        lineTo(w * 0.42f, h * 0.97f)
        cubicTo(w * 0.32f, h * 0.93f, w * 0.18f, h * 0.87f, w * 0.14f, h * 0.79f)
        quadraticTo(w * 0.1f, h * 0.66f, w * 0.1f, h * 0.44f)
        lineTo(w * 0.12f, h * 0.22f)
        cubicTo(w * 0.16f, h * 0.1f, w * 0.4f, h * 0.02f, w * 0.5f, h * 0.005f)
        close()
    }
    drawPath(path, BoardBlue.copy(alpha = 0.85f))
    drawPath(path, BoardBlueDark, style = Stroke(width = 0.8f))
    drawLine(Color.Black.copy(alpha = 0.12f), Offset(w * 0.5f, h * 0.03f), Offset(w * 0.5f, h * 0.97f), strokeWidth = 0.8f)
    drawFin(w * 0.5f, h * 0.87f, w * 0.44f, h * 0.94f, w * 0.56f, h * 0.94f)
    drawFin(w * 0.25f, h * 0.84f, w * 0.18f, h * 0.9f, w * 0.3f, h * 0.89f)
    drawFin(w * 0.75f, h * 0.84f, w * 0.82f, h * 0.9f, w * 0.7f, h * 0.89f)
}

private fun DrawScope.drawGun() {
    val w = size.width; val h = size.height
    // Very narrow, long, pintail
    val path = Path().apply {
        moveTo(w * 0.5f, h * 0.005f)
        cubicTo(w * 0.57f, h * 0.02f, w * 0.78f, h * 0.1f, w * 0.82f, h * 0.22f)
        lineTo(w * 0.84f, h * 0.42f)
        quadraticTo(w * 0.84f, h * 0.66f, w * 0.8f, h * 0.8f)
        cubicTo(w * 0.76f, h * 0.88f, w * 0.64f, h * 0.94f, w * 0.56f, h * 0.97f)
        lineTo(w * 0.5f, h * 0.995f)
        lineTo(w * 0.44f, h * 0.97f)
        cubicTo(w * 0.36f, h * 0.94f, w * 0.24f, h * 0.88f, w * 0.2f, h * 0.8f)
        quadraticTo(w * 0.16f, h * 0.66f, w * 0.16f, h * 0.42f)
        lineTo(w * 0.18f, h * 0.22f)
        cubicTo(w * 0.22f, h * 0.1f, w * 0.43f, h * 0.02f, w * 0.5f, h * 0.005f)
        close()
    }
    drawPath(path, BoardBlue.copy(alpha = 0.85f))
    drawPath(path, BoardBlueDark, style = Stroke(width = 0.8f))
    drawLine(Color.Black.copy(alpha = 0.12f), Offset(w * 0.5f, h * 0.03f), Offset(w * 0.5f, h * 0.97f), strokeWidth = 0.8f)
    drawFin(w * 0.5f, h * 0.87f, w * 0.44f, h * 0.94f, w * 0.56f, h * 0.94f)
    drawFin(w * 0.27f, h * 0.85f, w * 0.2f, h * 0.9f, w * 0.32f, h * 0.89f)
    drawFin(w * 0.73f, h * 0.85f, w * 0.8f, h * 0.9f, w * 0.68f, h * 0.89f)
}

private fun DrawScope.drawSUP() {
    val w = size.width; val h = size.height
    // Wide, thick, round
    val path = Path().apply {
        moveTo(w * 0.5f, h * 0.02f)
        cubicTo(w * 0.72f, h * 0.02f, w * 0.9f, h * 0.06f, w * 0.93f, h * 0.16f)
        lineTo(w * 0.95f, h * 0.4f)
        quadraticTo(w * 0.95f, h * 0.62f, w * 0.92f, h * 0.78f)
        cubicTo(w * 0.88f, h * 0.88f, w * 0.74f, h * 0.94f, w * 0.64f, h * 0.96f)
        quadraticTo(w * 0.5f, h * 0.99f, w * 0.36f, h * 0.96f)
        cubicTo(w * 0.26f, h * 0.94f, w * 0.12f, h * 0.88f, w * 0.08f, h * 0.78f)
        quadraticTo(w * 0.05f, h * 0.62f, w * 0.05f, h * 0.4f)
        lineTo(w * 0.07f, h * 0.16f)
        cubicTo(w * 0.1f, h * 0.06f, w * 0.28f, h * 0.02f, w * 0.5f, h * 0.02f)
        close()
    }
    drawPath(path, BoardBlue.copy(alpha = 0.85f))
    drawPath(path, BoardBlueDark, style = Stroke(width = 0.8f))
    drawLine(Color.Black.copy(alpha = 0.1f), Offset(w * 0.5f, h * 0.05f), Offset(w * 0.5f, h * 0.95f), strokeWidth = 0.8f)
    // Deck pad
    drawRoundRect(Color.Black.copy(alpha = 0.06f), Offset(w * 0.28f, h * 0.34f), Size(w * 0.44f, h * 0.28f), CornerRadius(3f))
    // Grip lines
    for (i in 0..4) {
        val y = h * (0.37f + i * 0.05f)
        drawLine(Color.Black.copy(alpha = 0.04f), Offset(w * 0.32f, y), Offset(w * 0.68f, y), strokeWidth = 0.6f)
    }
    // Carry handle
    drawRoundRect(Color.Black.copy(alpha = 0.1f), Offset(w * 0.42f, h * 0.47f), Size(w * 0.16f, h * 0.015f), CornerRadius(2f))
    // Single fin
    val fin = Path().apply {
        moveTo(w * 0.5f, h * 0.86f); lineTo(w * 0.42f, h * 0.93f); quadraticTo(w * 0.5f, h * 0.95f, w * 0.58f, h * 0.93f); close()
    }
    drawPath(fin, FinColor)
}

private fun DrawScope.drawFin(topX: Float, topY: Float, leftX: Float, leftY: Float, rightX: Float, rightY: Float) {
    val fin = Path().apply {
        moveTo(topX, topY)
        lineTo(leftX, leftY)
        quadraticTo((leftX + rightX) / 2, leftY + (leftY - topY) * 0.15f, rightX, rightY)
        close()
    }
    drawPath(fin, FinColor)
}

// --- Wetsuit / boardshorts ---

private val GearGray = Color(0xFF64748B)
private val GearGrayDark = Color(0xFF475569)

private fun DrawScope.drawWetsuit() {
    val w = size.width; val h = size.height
    val path = Path().apply {
        // Neck
        moveTo(w * 0.38f, h * 0.04f)
        quadraticTo(w * 0.5f, h * 0.02f, w * 0.62f, h * 0.04f)
        // Right shoulder → sleeve
        lineTo(w * 0.72f, h * 0.08f)
        lineTo(w * 0.92f, h * 0.2f)
        lineTo(w * 0.88f, h * 0.26f)
        lineTo(w * 0.72f, h * 0.16f)
        // Right torso → leg
        lineTo(w * 0.68f, h * 0.38f)
        lineTo(w * 0.72f, h * 0.65f)
        lineTo(w * 0.7f, h * 0.98f)
        lineTo(w * 0.56f, h * 0.98f)
        // Crotch
        lineTo(w * 0.5f, h * 0.6f)
        lineTo(w * 0.44f, h * 0.98f)
        // Left leg
        lineTo(w * 0.3f, h * 0.98f)
        lineTo(w * 0.28f, h * 0.65f)
        lineTo(w * 0.32f, h * 0.38f)
        // Left sleeve
        lineTo(w * 0.28f, h * 0.16f)
        lineTo(w * 0.12f, h * 0.26f)
        lineTo(w * 0.08f, h * 0.2f)
        lineTo(w * 0.28f, h * 0.08f)
        close()
    }
    drawPath(path, GearGray.copy(alpha = 0.85f))
    drawPath(path, GearGrayDark, style = Stroke(width = 0.8f))
    // Zip line
    drawLine(Color.Black.copy(alpha = 0.15f), Offset(w * 0.5f, h * 0.05f), Offset(w * 0.5f, h * 0.32f), strokeWidth = 0.8f, cap = StrokeCap.Round)
}

private fun DrawScope.drawBoardshorts() {
    val w = size.width; val h = size.height
    val path = Path().apply {
        moveTo(w * 0.2f, h * 0.15f)
        lineTo(w * 0.8f, h * 0.15f)
        lineTo(w * 0.82f, h * 0.22f)
        lineTo(w * 0.78f, h * 0.88f)
        lineTo(w * 0.56f, h * 0.88f)
        lineTo(w * 0.5f, h * 0.52f)
        lineTo(w * 0.44f, h * 0.88f)
        lineTo(w * 0.22f, h * 0.88f)
        lineTo(w * 0.18f, h * 0.22f)
        close()
    }
    drawPath(path, GearGray.copy(alpha = 0.85f))
    drawPath(path, GearGrayDark, style = Stroke(width = 0.8f))
    // Waistband
    drawLine(Color.Black.copy(alpha = 0.15f), Offset(w * 0.22f, h * 0.22f), Offset(w * 0.78f, h * 0.22f), strokeWidth = 0.8f)
}
