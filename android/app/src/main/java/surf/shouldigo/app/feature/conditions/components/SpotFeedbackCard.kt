package surf.shouldigo.app.feature.conditions.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import surf.shouldigo.app.data.model.ScoreBreakdown
import surf.shouldigo.app.ui.theme.*

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SpotFeedbackCard(
    spotId: String,
    breakdown: ScoreBreakdown,
    viewModel: SpotFeedbackViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(spotId) {
        viewModel.loadFeedback(spotId)
    }

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = CardBackground
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Text(
                text = "Is this score right?",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PrimaryText
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Share your local knowledge and we\u2019ll fine-tune the scoring \u2014 e.g. \u201Cneeds longer period\u201D or \u201Cworks best on south swell\u201D",
                fontSize = 12.sp,
                color = SecondaryText
            )

            if (uiState.feedbackCount > 0) {
                Spacer(modifier = Modifier.height(8.dp))
                Surface(shape = CircleShape, color = Accent.copy(alpha = 0.1f)) {
                    Text(
                        text = "Tuned by ${uiState.feedbackCount} surfer${if (uiState.feedbackCount != 1) "s" else ""}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Accent,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Text input
            OutlinedTextField(
                value = uiState.text,
                onValueChange = { viewModel.updateText(it) },
                placeholder = { Text("e.g. Wave period is everything here...") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                maxLines = 5,
                enabled = !uiState.isLoading,
                textStyle = LocalTextStyle.current.copy(fontSize = 14.sp)
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Submit button
            val canSubmit = uiState.text.trim().length >= 10 && !uiState.isLoading
            Button(
                onClick = { viewModel.submit(spotId) },
                enabled = canSubmit,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (canSubmit) Accent else SecondaryText.copy(alpha = 0.3f)
                )
            ) {
                Text(
                    text = if (uiState.isLoading) "Reading the local knowledge..." else "Adjust Score",
                    fontWeight = FontWeight.SemiBold
                )
            }

            // Multiplier tags
            uiState.multipliers?.let { mults ->
                Spacer(modifier = Modifier.height(12.dp))
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    val labels = listOf(
                        "waveHeight" to "Wave Height",
                        "wavePeriod" to "Wave Period",
                        "swellQuality" to "Swell Quality",
                        "windSpeed" to "Surface Calm",
                        "windDirection" to "Wind Direction",
                        "waveDirection" to "Wave Direction"
                    )
                    labels.forEach { (key, label) ->
                        mults[key]?.let { value ->
                            val pct = ((value - 1) * 100).toInt()
                            if (kotlin.math.abs(pct) >= 5) {
                                val isPositive = pct > 0
                                Surface(
                                    shape = CircleShape,
                                    color = if (isPositive) Color.Green.copy(alpha = 0.15f)
                                    else Color.Red.copy(alpha = 0.15f)
                                ) {
                                    Text(
                                        text = "$label ${if (isPositive) "+" else ""}$pct%",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = if (isPositive) Color(0xFF16A34A) else Color(0xFFDC2626),
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Recent feedback
            if (uiState.recentFeedback.isNotEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))
                TextButton(onClick = { viewModel.toggleRecent() }) {
                    Text(
                        text = "${if (uiState.showRecent) "Hide" else "Show"} local tips (${uiState.recentFeedback.size})",
                        fontSize = 12.sp,
                        color = Accent
                    )
                }
                AnimatedVisibility(visible = uiState.showRecent) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        uiState.recentFeedback.forEach { feedback ->
                            Text(
                                text = "\"${feedback.text}\"",
                                fontSize = 12.sp,
                                color = SecondaryText,
                                fontStyle = FontStyle.Italic
                            )
                        }
                    }
                }
            }
        }
    }
}
