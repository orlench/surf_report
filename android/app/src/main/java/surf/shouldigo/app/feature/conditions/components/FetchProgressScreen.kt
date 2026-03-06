package surf.shouldigo.app.feature.conditions.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import surf.shouldigo.app.data.repository.ProgressStep
import surf.shouldigo.app.ui.theme.*

@Composable
fun FetchProgressScreen(steps: List<ProgressStep>, spotName: String) {
    val infiniteTransition = rememberInfiniteTransition(label = "wave")
    val rotation by infiniteTransition.animateFloat(
        initialValue = -10f,
        targetValue = 10f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "wave_rotation"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "\uD83C\uDF0A",
            fontSize = 48.sp,
            modifier = Modifier.rotate(rotation)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Checking conditions",
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = PrimaryText
        )

        Text(
            text = spotName,
            fontSize = 14.sp,
            color = SecondaryText
        )

        Spacer(modifier = Modifier.height(24.dp))

        steps.forEach { step ->
            Row(
                modifier = Modifier
                    .fillMaxWidth(0.7f)
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                when (step.status) {
                    "loading" -> CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = Accent
                    )
                    "success" -> Icon(
                        Icons.Default.Check,
                        contentDescription = null,
                        tint = ScoreGood,
                        modifier = Modifier.size(16.dp)
                    )
                    else -> Icon(
                        Icons.Default.Close,
                        contentDescription = null,
                        tint = ScoreFlat,
                        modifier = Modifier.size(16.dp)
                    )
                }
                Text(
                    text = step.label,
                    fontSize = 13.sp,
                    color = SecondaryText
                )
            }
        }
    }
}
