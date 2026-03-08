package surf.shouldigo.app.feature.spotpicker

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import surf.shouldigo.app.data.model.CustomSpotMeta
import surf.shouldigo.app.data.model.NearbySpot
import surf.shouldigo.app.data.model.Spot
import surf.shouldigo.app.data.repository.SpotRepository
import javax.inject.Inject

data class SpotPickerUiState(
    val allSpots: List<Spot> = emptyList(),
    val nearbySpots: List<NearbySpot> = emptyList(),
    val recentCustomSpots: List<CustomSpotMeta> = emptyList(),
    val searchText: String = "",
    val isLoading: Boolean = false
) {
    val filteredSpots: List<Spot>
        get() {
            if (searchText.length < 2) return allSpots
            val query = searchText.lowercase()
            return allSpots.filter {
                it.name.lowercase().contains(query) ||
                it.country.lowercase().contains(query) ||
                (it.region?.lowercase()?.contains(query) == true)
            }
        }

    val groupedSpots: Map<String, List<Spot>>
        get() = filteredSpots.groupBy { it.country.ifEmpty { "Other" } }
            .toSortedMap()
}

@HiltViewModel
class SpotPickerViewModel @Inject constructor(
    private val spotRepo: SpotRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SpotPickerUiState())
    val uiState: StateFlow<SpotPickerUiState> = _uiState

    init {
        load()
    }

    fun updateSearch(text: String) {
        _uiState.update { it.copy(searchText = text) }
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            // Load recent custom spots
            val recent = spotRepo.getRecentCustomSpots()
            _uiState.update { it.copy(recentCustomSpots = recent) }

            // Fetch spots from API
            try {
                val spots = spotRepo.fetchSpots()
                _uiState.update { it.copy(allSpots = spots) }
            } catch (_: Exception) {}

            // Fetch nearby
            try {
                val nearest = spotRepo.fetchNearestSpot()
                _uiState.update { it.copy(nearbySpots = nearest.nearbySpots ?: emptyList()) }
            } catch (_: Exception) {}

            _uiState.update { it.copy(isLoading = false) }
        }
    }
}
