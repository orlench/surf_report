package surf.shouldigo.app.data.local

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.qualifiers.ApplicationContext
import surf.shouldigo.app.data.model.Spot
import surf.shouldigo.app.data.model.SpotLocation
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SpotDataSource @Inject constructor(
    @ApplicationContext private val context: Context,
    private val gson: Gson
) {
    private var cachedSpots: List<Spot>? = null

    fun loadAllSpots(): List<Spot> {
        cachedSpots?.let { return it }

        val json = context.assets.open("surfSpots.json")
            .bufferedReader()
            .use { it.readText() }

        val wrapper = gson.fromJson(json, SpotFileWrapper::class.java)
        val spots = wrapper.spots.map { raw ->
            Spot(
                id = raw.id,
                name = raw.name,
                country = raw.country ?: "",
                region = raw.region,
                location = if (raw.lat != null && raw.lon != null) {
                    SpotLocation(raw.lat, raw.lon)
                } else null,
                description = raw.description
            )
        }
        cachedSpots = spots
        return spots
    }

    private data class SpotFileWrapper(val spots: List<RawSpot>)
    private data class RawSpot(
        val id: String,
        val name: String,
        val country: String? = null,
        val region: String? = null,
        val lat: Double? = null,
        val lon: Double? = null,
        val description: String? = null
    )
}
