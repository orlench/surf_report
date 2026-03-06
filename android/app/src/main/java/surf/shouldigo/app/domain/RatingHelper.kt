package surf.shouldigo.app.domain

import androidx.compose.ui.graphics.Color
import surf.shouldigo.app.ui.theme.*

fun ratingColor(rating: String): Color = when (rating) {
    "EPIC" -> ScoreEpic
    "GREAT" -> ScoreGreat
    "GOOD" -> ScoreGood
    "FAIR" -> ScoreFair
    "MARGINAL" -> ScoreMarginal
    "POOR" -> ScorePoor
    else -> ScoreFlat
}

fun ratingEmoji(rating: String): String = when (rating) {
    "EPIC" -> "\uD83D\uDD25"   // fire
    "GREAT" -> "\uD83E\uDD19"  // shaka
    "GOOD" -> "\uD83D\uDC4D"   // thumbs up
    "FAIR" -> "\uD83D\uDE10"   // neutral
    "POOR" -> "\uD83D\uDC4E"   // thumbs down
    else -> "\uD83C\uDFE0"     // house
}

fun surfVerdict(score: Int): String = when {
    score >= 85 -> "Absolutely!"
    score >= 75 -> "Get out there!"
    score >= 65 -> "Yes, go!"
    score >= 50 -> "Maybe..."
    score >= 35 -> "Probably not"
    score >= 20 -> "Not worth it"
    else -> "Stay home"
}

fun letterGrade(score: Int): String = when {
    score >= 90 -> "A+"
    score >= 80 -> "A"
    score >= 70 -> "B"
    score >= 60 -> "C"
    score >= 45 -> "D"
    else -> "F"
}

fun boardEmoji(boardType: String): String = when (boardType) {
    "sup" -> "\uD83C\uDFC4"
    "longboard" -> "\uD83C\uDFC4"
    "fish" -> "\uD83D\uDC1F"
    "midlength" -> "\uD83C\uDFC4"
    "shortboard" -> "\uD83C\uDFC4"
    "stepup" -> "\u26A0\uFE0F"
    "gun" -> "\uD83D\uDE80"
    else -> "\uD83C\uDFC4"
}

fun wetsuitRecommendation(waterTemp: Double?): Pair<String, String> {
    val temp = waterTemp ?: return "Unknown" to "No water temp data"
    return when {
        temp >= 24 -> "Boardshorts" to "Warm water, no wetsuit needed"
        temp >= 20 -> "Spring suit" to "Mild water, light coverage"
        temp >= 16 -> "3/2 Wetsuit" to "Cool water, full suit recommended"
        else -> "4/3 Wetsuit" to "Cold water, thick suit essential"
    }
}
