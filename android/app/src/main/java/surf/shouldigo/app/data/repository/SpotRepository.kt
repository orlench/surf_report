package surf.shouldigo.app.data.repository

import surf.shouldigo.app.data.local.CustomSpotStore
import surf.shouldigo.app.data.model.CreateSpotRequest
import surf.shouldigo.app.data.model.CustomSpotMeta
import surf.shouldigo.app.data.model.NearestSpotResponse
import surf.shouldigo.app.data.model.Spot
import surf.shouldigo.app.data.remote.ApiService
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SpotRepository @Inject constructor(
    private val api: ApiService,
    private val customSpotStore: CustomSpotStore
) {
    suspend fun fetchSpots(): List<Spot> {
        return api.fetchSpots().spots
    }

    suspend fun fetchNearestSpot(lat: Double? = null, lon: Double? = null): NearestSpotResponse {
        return api.fetchNearestSpot(lat, lon)
    }

    suspend fun createSpot(name: String, lat: Double, lon: Double, country: String?) {
        try {
            api.createSpot(CreateSpotRequest(name, lat, lon, country))
        } catch (_: Exception) {
            // Fire and forget
        }
    }

    fun getCustomSpots(): List<CustomSpotMeta> = customSpotStore.all()

    fun getRecentCustomSpots(limit: Int = 5): List<CustomSpotMeta> = customSpotStore.recent(limit)

    fun findCustomSpot(id: String): CustomSpotMeta? = customSpotStore.find(id)

    fun saveCustomSpot(meta: CustomSpotMeta) = customSpotStore.save(meta)
}
