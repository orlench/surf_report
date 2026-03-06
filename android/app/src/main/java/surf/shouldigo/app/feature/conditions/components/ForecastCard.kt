package surf.shouldigo.app.feature.conditions.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import surf.shouldigo.app.data.model.ForecastBlock
import surf.shouldigo.app.data.model.SurfTrend
import surf.shouldigo.app.ui.theme.*

@Composable
fun ForecastCard(blocks: List<ForecastBlock>, trend: SurfTrend?) {
    val trendArrow = when (trend?.trend) {
        "improving" -> "\u2197"
        "declining" -> "\u2198"
        else -> "\u2192"
    }

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = CardBackground
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            SectionHeader("Forecast")
            Spacer(modifier = Modifier.height(14.dp))

            trend?.message?.let { message ->
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = Background
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(text = trendArrow, fontSize = 18.sp)
                        Text(
                            text = message,
                            fontSize = 14.sp,
                            color = Color(0xFF4A5568)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(14.dp))
            }

            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(blocks, key = { it.label }) { block ->
                    val isBest = trend?.bestWindow?.label == block.label
                    ForecastTile(block = block, isBest = isBest)
                }
            }
        }
    }
}

@Composable
private fun ForecastTile(block: ForecastBlock, isBest: Boolean) {
    val color = scoreColor(block.score)

    val modifier = if (isBest) {
        Modifier.border(1.5.dp, Accent, RoundedCornerShape(12.dp))
    } else {
        Modifier
    }

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = Background,
        modifier = modifier.width(100.dp)
    ) {
        Column(
            modifier = Modifier.padding(vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = block.label,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = SecondaryText,
                maxLines = 1,
                textAlign = TextAlign.Center
            )
            Text(
                text = "${block.score}",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = color
            )
            Surface(
                shape = CircleShape,
                color = color.copy(alpha = 0.15f)
            ) {
                Text(
                    text = block.rating,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = color,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                )
            }
        }
    }
}
