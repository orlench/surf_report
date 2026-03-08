package surf.shouldigo.app.feature.map

import androidx.lifecycle.ViewModel
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import surf.shouldigo.app.data.local.CustomSpotStore
import surf.shouldigo.app.data.local.SpotDataSource
import surf.shouldigo.app.data.model.CustomSpotMeta
import surf.shouldigo.app.data.model.Spot
import javax.inject.Inject

data class MapUiState(
    val allSpots: List<Spot> = emptyList(),
    val searchText: String = "",
    val searchResults: List<Spot> = emptyList(),
    val selectedSpot: Spot? = null
)

@HiltViewModel
class SpotMapViewModel @Inject constructor(
    private val spotDataSource: SpotDataSource,
    private val customSpotStore: CustomSpotStore
) : ViewModel() {

    private val _uiState = MutableStateFlow(MapUiState())
    val uiState: StateFlow<MapUiState> = _uiState

    init {
        val spots = spotDataSource.loadAllSpots()
        _uiState.value = MapUiState(allSpots = spots)
    }

    fun updateSearch(text: String) {
        _uiState.update { state ->
            val results = if (text.length >= 2) {
                val query = text.lowercase()
                state.allSpots
                    .filter {
                        it.name.lowercase().contains(query) ||
                        it.country.lowercase().contains(query)
                    }
                    .take(20)
            } else emptyList()
            state.copy(searchText = text, searchResults = results)
        }
    }

    fun selectSpot(spot: Spot) {
        _uiState.update { it.copy(selectedSpot = spot) }
    }

    fun clearSelection() {
        _uiState.update { it.copy(selectedSpot = null) }
    }

    fun visibleSpots(bounds: LatLngBounds): List<Spot> {
        return _uiState.value.allSpots
            .filter { spot ->
                spot.location?.let { loc ->
                    bounds.contains(LatLng(loc.lat, loc.lon))
                } ?: false
            }
            .take(200)
    }

    fun saveCustomSpot(name: String, lat: Double, lon: Double, country: String?): Spot {
        val id = name.lowercase().replace(Regex("[^a-z0-9]+"), "_").trim('_')
        customSpotStore.save(CustomSpotMeta(id, name, lat, lon, country))
        return Spot(id = id, name = name, country = country ?: "")
    }
}
