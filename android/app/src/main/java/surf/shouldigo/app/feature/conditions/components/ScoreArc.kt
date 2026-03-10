package surf.shouldigo.app.feature.conditions.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ScoreArc(score: Int, modifier: Modifier = Modifier) {
    val fraction by animateFloatAsState(
        targetValue = score / 100f,
        animationSpec = spring(dampingRatio = 0.7f, stiffness = 200f),
        label = "score"
    )

    Box(modifier = modifier, contentAlignment = Alignment.BottomCenter) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val strokeWidth = 12.dp.toPx()
            val padding = strokeWidth / 2 + 4.dp.toPx()
            val arcDiameter = size.width - padding * 2
            val arcSize = Size(arcDiameter, arcDiameter)
            // Anchor semi-circle to bottom of canvas so it never overflows upward
            val topLeft = Offset(padding, size.height - arcDiameter / 2)

            // Track arc
            drawArc(
                color = Color.White.copy(alpha = 0.25f),
                startAngle = 180f,
                sweepAngle = 180f,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
            )

            // Fill arc
            drawArc(
                color = Color.White.copy(alpha = 0.9f),
                startAngle = 180f,
                sweepAngle = fraction * 180f,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
            )
        }

        Text(
            text = "$score",
            fontSize = 48.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            modifier = Modifier.offset(y = (-16).dp)
        )
    }
}
