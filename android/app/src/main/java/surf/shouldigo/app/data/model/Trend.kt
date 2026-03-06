package surf.shouldigo.app.data.model

data class SurfTrend(
    val trend: String? = null,
    val summary: String? = null,
    val message: String? = null,
    val bestWindow: BestWindow? = null,
    val blocks: List<ForecastBlock>? = null
)

data class BestWindow(
    val label: String,
    val score: Int,
    val rating: String
)

data class ForecastBlock(
    val label: String,
    val score: Int,
    val rating: String,
    val ratingGrade: String? = null,
    val conditions: SurfConditions? = null
)
