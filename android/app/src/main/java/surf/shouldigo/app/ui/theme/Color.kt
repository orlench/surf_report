package surf.shouldigo.app.ui.theme

import androidx.compose.ui.graphics.Color

val ScoreEpic = Color(0xFF00C48C)
val ScoreGreat = Color(0xFF28D278)
val ScoreGood = Color(0xFF4CD964)
val ScoreFair = Color(0xFFF5A623)
val ScoreMarginal = Color(0xFFE67E22)
val ScorePoor = Color(0xFFFF6B35)
val ScoreFlat = Color(0xFFFF3B30)

val Background = Color(0xFFF8F9FA)
val CardBackground = Color.White
val PrimaryText = Color(0xFF0A1628)
val SecondaryText = Color(0xFF6B7280)
val Accent = Color(0xFF2563EB)

fun scoreColor(score: Int): Color = when {
    score >= 85 -> ScoreEpic
    score >= 75 -> ScoreGreat
    score >= 65 -> ScoreGood
    score >= 50 -> ScoreFair
    score >= 35 -> ScorePoor
    else -> ScoreFlat
}
