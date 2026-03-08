package surf.shouldigo.app.data.model

data class ConditionsResponse(
    val spotId: String,
    val spotName: String,
    val timestamp: String,
    val score: SurfScore,
    val conditions: SurfConditions,
    val trend: SurfTrend? = null,
    val boardRecommendation: BoardRecommendation? = null,
    val sources: List<DataSource>? = null,
    val fromCache: Boolean? = null,
    val cacheAge: Int? = null
)

data class SurfScore(
    val overall: Int,
    val rating: String,
    val explanation: String? = null,
    val breakdown: ScoreBreakdown? = null
)

data class ScoreBreakdown(
    val waveHeight: Int,
    val wavePeriod: Int,
    val swellQuality: Int,
    val windSpeed: Int,
    val windDirection: Int,
    val waveDirection: Int
)

data class SurfConditions(
    val waves: WaveConditions? = null,
    val wind: WindConditions? = null,
    val weather: WeatherConditions? = null,
    val tide: TideConditions? = null
)

data class WaveConditions(
    val height: WaveHeight? = null,
    val period: Double? = null,
    val direction: String? = null,
    val swell: SwellConditions? = null
)

data class WaveHeight(
    val min: Double? = null,
    val max: Double? = null,
    val avg: Double? = null
)

data class SwellConditions(
    val height: Double? = null,
    val period: Double? = null,
    val direction: String? = null
)

data class WindConditions(
    val speed: Double? = null,
    val direction: String? = null,
    val gusts: Double? = null
)

data class WeatherConditions(
    val airTemp: Double? = null,
    val waterTemp: Double? = null,
    val cloudCover: Double? = null
)

data class TideConditions(
    val current: String? = null,
    val height: Double? = null
)

data class DataSource(
    val name: String,
    val status: String,
    val timestamp: String? = null,
    val url: String? = null
)
