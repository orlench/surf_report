package surf.shouldigo.app.data.model

data class SpotListResponse(
    val success: Boolean,
    val count: Int,
    val spots: List<Spot>
)

data class Spot(
    val id: String,
    val name: String,
    val country: String = "",
    val region: String? = null,
    val location: SpotLocation? = null,
    val description: String? = null
) {
    val lat: Double get() = location?.lat ?: 0.0
    val lon: Double get() = location?.lon ?: 0.0
}

data class SpotLocation(
    val lat: Double,
    val lon: Double
)

data class NearestSpotResponse(
    val success: Boolean,
    val detected: Boolean,
    val location: DetectedLocation? = null,
    val nearestSpot: String? = null,
    val nearestSpotName: String? = null,
    val distance: Double? = null,
    val nearbySpots: List<NearbySpot>? = null
)

data class DetectedLocation(
    val city: String?,
    val country: String?
)

data class NearbySpot(
    val id: String,
    val name: String,
    val country: String = "",
    val distance: Double? = null
)

data class CreateSpotRequest(
    val name: String,
    val lat: Double,
    val lon: Double,
    val country: String? = null
)

data class CustomSpotMeta(
    val id: String,
    val name: String,
    val lat: Double,
    val lon: Double,
    val country: String? = null
)
