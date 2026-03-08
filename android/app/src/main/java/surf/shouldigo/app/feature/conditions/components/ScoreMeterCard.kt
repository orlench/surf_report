package surf.shouldigo.app.feature.conditions.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import surf.shouldigo.app.data.model.SurfConditions
import surf.shouldigo.app.data.model.SurfScore
import surf.shouldigo.app.domain.ratingColor
import surf.shouldigo.app.domain.surfVerdict

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ScoreMeterCard(
    score: SurfScore,
    conditions: SurfConditions,
    timestamp: String,
    fromCache: Boolean?,
    cacheAge: Int?,
    onRefresh: () -> Unit
) {
    val heroColor = ratingColor(score.rating)

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = heroColor,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Should I go?",
                fontSize = 14.sp,
                color = Color.White.copy(alpha = 0.7f)
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = surfVerdict(score.overall),
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )

            Spacer(modifier = Modifier.height(8.dp))

            ScoreArc(
                score = score.overall,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(140.dp)
            )

            Text(
                text = score.rating,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.75f),
                letterSpacing = 1.5.sp
            )

            score.explanation?.let { explanation ->
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = explanation,
                    fontSize = 14.sp,
                    color = Color.White.copy(alpha = 0.85f),
                    textAlign = TextAlign.Center,
                    maxLines = 3
                )
            }

            // Wave height
            waveText(conditions)?.let { wave ->
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = wave,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }

            // Detail pills
            val pills = buildPills(conditions)
            if (pills.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    pills.forEach { pill ->
                        Surface(
                            shape = CircleShape,
                            color = Color.White.copy(alpha = 0.2f)
                        ) {
                            Text(
                                text = pill,
                                fontSize = 12.sp,
                                color = Color.White,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                            )
                        }
                    }
                }
            }

            // Updated + refresh
            val updated = updatedText(fromCache, cacheAge, timestamp)
            if (updated.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = updated,
                        fontSize = 12.sp,
                        color = Color.White.copy(alpha = 0.6f)
                    )
                    IconButton(onClick = onRefresh, modifier = Modifier.size(20.dp)) {
                        Icon(
                            Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = Color.White.copy(alpha = 0.6f),
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
        }
    }
}

private fun waveText(conditions: SurfConditions): String? {
    val min = conditions.waves?.height?.min
    val max = conditions.waves?.height?.max
    val avg = conditions.waves?.height?.avg
    return when {
        min != null && max != null -> "%.1f–%.1fm".format(min, max)
        avg != null -> "%.1fm".format(avg)
        else -> null
    }
}

private fun windDesc(speed: Double): String = when {
    speed < 10 -> "Calm"
    speed < 20 -> "Light breeze"
    speed < 30 -> "Breezy"
    speed < 40 -> "Windy"
    else -> "Very windy"
}

private fun periodDesc(period: Double): String = when {
    period >= 12 -> "Clean"
    period >= 9 -> "Decent"
    period >= 6 -> "Short"
    else -> "Choppy"
}

private fun buildPills(conditions: SurfConditions): List<String> {
    val pills = mutableListOf<String>()
    conditions.waves?.period?.let { p ->
        pills.add("${periodDesc(p)} ${p.toInt()}s swell")
    }
    conditions.waves?.direction?.let { d ->
        pills.add("$d direction")
    }
    conditions.wind?.speed?.let { ws ->
        var t = windDesc(ws)
        conditions.wind?.direction?.let { wd -> t += " $wd" }
        t += " ${ws.toInt()} km/h"
        pills.add(t)
    }
    conditions.weather?.airTemp?.let { at ->
        pills.add("${at.toInt()}\u00B0C air")
    }
    conditions.weather?.waterTemp?.let { wt ->
        pills.add("${wt.toInt()}\u00B0C water")
    }
    return pills
}

private fun updatedText(fromCache: Boolean?, cacheAge: Int?, timestamp: String): String {
    if (fromCache == true && cacheAge != null) {
        return "Updated ${cacheAge / 60} min ago"
    }
    try {
        val instant = java.time.Instant.parse(timestamp)
        val mins = java.time.Duration.between(instant, java.time.Instant.now()).toMinutes()
        return when {
            mins < 1 -> "Updated just now"
            mins < 60 -> "Updated $mins min ago"
            else -> "Updated ${mins / 60} hour${if (mins / 60 > 1) "s" else ""} ago"
        }
    } catch (_: Exception) {
        return ""
    }
}
