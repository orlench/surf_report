package surf.shouldigo.app.feature.conditions.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import surf.shouldigo.app.data.model.ScoreBreakdown
import surf.shouldigo.app.domain.letterGrade
import surf.shouldigo.app.ui.theme.*

@Composable
fun BreakdownCard(breakdown: ScoreBreakdown) {
    val items = listOf(
        Triple("Wave Height", breakdown.waveHeight, heightHint(breakdown.waveHeight)),
        Triple("Wave Period", breakdown.wavePeriod, periodHint(breakdown.wavePeriod)),
        Triple("Swell Quality", breakdown.swellQuality, swellHint(breakdown.swellQuality)),
        Triple("Surface Calm", breakdown.windSpeed, windHint(breakdown.windSpeed)),
        Triple("Wind Direction", breakdown.windDirection, windDirHint(breakdown.windDirection)),
        Triple("Wave Direction", breakdown.waveDirection, waveDirHint(breakdown.waveDirection))
    )

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = CardBackground
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            SectionHeader("Score Breakdown")
            Spacer(modifier = Modifier.height(14.dp))
            items.forEach { (label, score, hint) ->
                BreakdownBar(label = label, score = score, hint = hint)
                Spacer(modifier = Modifier.height(14.dp))
            }
        }
    }
}

@Composable
private fun BreakdownBar(label: String, score: Int, hint: String) {
    val color = scoreColor(score)
    val grade = letterGrade(score)
    val animatedFraction by animateFloatAsState(
        targetValue = score / 100f,
        animationSpec = spring(dampingRatio = 0.8f, stiffness = 300f),
        label = "bar"
    )

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = grade,
                fontSize = 16.sp,
                fontWeight = FontWeight.ExtraBold,
                color = color,
                modifier = Modifier.width(22.dp)
            )
            Column {
                Text(
                    text = label,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PrimaryText
                )
                Text(
                    text = hint,
                    fontSize = 12.sp,
                    color = SecondaryText
                )
            }
        }
        LinearProgressIndicator(
            progress = { animatedFraction },
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 32.dp)
                .height(4.dp),
            color = color,
            trackColor = SecondaryText.copy(alpha = 0.1f),
            strokeCap = StrokeCap.Round
        )
    }
}

@Composable
fun SectionHeader(title: String) {
    Text(
        text = title,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        color = SecondaryText
    )
}

private fun heightHint(v: Int) = when {
    v >= 80 -> "Ideal size"; v >= 60 -> "Decent size"; v >= 40 -> "A bit small"
    v >= 20 -> "Very small"; else -> "Flat"
}
private fun periodHint(v: Int) = when {
    v >= 80 -> "Long, clean waves"; v >= 60 -> "Good quality"; v >= 40 -> "Short period"
    v >= 20 -> "Wind chop"; else -> "Very choppy"
}
private fun swellHint(v: Int) = when {
    v >= 80 -> "Solid groundswell"; v >= 60 -> "Decent swell"; v >= 40 -> "Mixed swell"
    v >= 20 -> "Mostly wind swell"; else -> "No real swell"
}
private fun windHint(v: Int) = when {
    v >= 80 -> "Glassy, barely any wind"; v >= 60 -> "Light breeze"; v >= 40 -> "Moderate wind"
    v >= 20 -> "Strong wind"; else -> "Blown out"
}
private fun windDirHint(v: Int) = when {
    v >= 80 -> "Offshore"; v >= 60 -> "Cross-shore"; v >= 40 -> "Side-on"
    v >= 20 -> "Onshore"; else -> "Direct onshore"
}
private fun waveDirHint(v: Int) = when {
    v >= 80 -> "Perfect angle"; v >= 60 -> "Good angle"; v >= 40 -> "Okay angle"
    v >= 20 -> "Off angle"; else -> "Wrong direction"
}
