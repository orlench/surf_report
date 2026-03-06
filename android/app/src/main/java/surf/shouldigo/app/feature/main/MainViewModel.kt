package surf.shouldigo.app.feature.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import surf.shouldigo.app.data.local.PreferencesManager
import surf.shouldigo.app.data.model.NearbySpot
import surf.shouldigo.app.data.model.Spot
import surf.shouldigo.app.data.repository.SpotRepository
import javax.inject.Inject

data class MainUiState(
    val selectedSpot: Spot? = null,
    val isAutoDetecting: Boolean = false,
    val nearbySpots: List<NearbySpot> = emptyList()
)

@HiltViewModel
class MainViewModel @Inject constructor(
    private val spotRepo: SpotRepository,
    private val prefs: PreferencesManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(MainUiState())
    val uiState: StateFlow<MainUiState> = _uiState

    init {
        val savedId = prefs.lastSelectedSpotId
        val savedName = prefs.lastSelectedSpotName
        if (savedId != null && savedName != null) {
            _uiState.value = MainUiState(selectedSpot = Spot(id = savedId, name = savedName))
        } else {
            autoDetect()
        }
    }

    fun selectSpot(spot: Spot) {
        _uiState.value = _uiState.value.copy(selectedSpot = spot)
        prefs.lastSelectedSpotId = spot.id
        prefs.lastSelectedSpotName = spot.name
    }

    fun autoDetect() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isAutoDetecting = true)
            try {
                val response = spotRepo.fetchNearestSpot()
                val nearbySpots = response.nearbySpots ?: emptyList()
                _uiState.value = _uiState.value.copy(nearbySpots = nearbySpots)

                if (response.nearestSpot != null && response.nearestSpotName != null) {
                    val spot = Spot(
                        id = response.nearestSpot,
                        name = response.nearestSpotName
                    )
                    selectSpot(spot)
                }
            } catch (_: Exception) {
                // Auto-detect failed, user can pick manually
            } finally {
                _uiState.value = _uiState.value.copy(isAutoDetecting = false)
            }
        }
    }

    fun handleDeepLink(spotId: String) {
        selectSpot(Spot(id = spotId, name = spotId.replace("_", " ").replaceFirstChar { it.uppercase() }))
    }
}
