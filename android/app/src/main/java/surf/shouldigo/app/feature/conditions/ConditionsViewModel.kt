package surf.shouldigo.app.feature.conditions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import surf.shouldigo.app.data.local.CustomSpotStore
import surf.shouldigo.app.data.model.Spot
import surf.shouldigo.app.data.repository.ConditionsRepository
import surf.shouldigo.app.data.repository.FetchState
import surf.shouldigo.app.data.repository.SpotRepository
import javax.inject.Inject

@HiltViewModel
class ConditionsViewModel @Inject constructor(
    private val conditionsRepo: ConditionsRepository,
    private val spotRepo: SpotRepository,
    private val customSpotStore: CustomSpotStore
) : ViewModel() {

    private val _state = MutableStateFlow<FetchState>(FetchState.Idle)
    val state: StateFlow<FetchState> = _state

    private var currentSpotId: String? = null
    private var loadJob: Job? = null

    fun load(spot: Spot) {
        if (currentSpotId == spot.id && _state.value is FetchState.Loaded) return

        currentSpotId = spot.id
        loadJob?.cancel()

        // Check if custom spot
        val customMeta = customSpotStore.find(spot.id)
        if (customMeta != null) {
            loadCustomSpot(customMeta)
            return
        }

        loadJob = viewModelScope.launch {
            conditionsRepo.streamConditions(spot.id).collect { fetchState ->
                _state.value = fetchState
            }
        }
    }

    fun refresh(spot: Spot) {
        currentSpotId = null
        _state.value = FetchState.Idle
        load(spot)
    }

    private fun loadCustomSpot(meta: surf.shouldigo.app.data.model.CustomSpotMeta) {
        loadJob = viewModelScope.launch {
            _state.value = FetchState.Streaming(
                listOf(surf.shouldigo.app.data.repository.ProgressStep("fetch", "Fetching conditions...", "loading"))
            )
            // Fire-and-forget: register spot on backend
            launch {
                spotRepo.createSpot(meta.name, meta.lat, meta.lon, meta.country)
            }
            try {
                val response = conditionsRepo.fetchCustomConditions(
                    meta.lat, meta.lon, meta.name, meta.country
                )
                _state.value = FetchState.Loaded(response)
            } catch (e: Exception) {
                _state.value = FetchState.Error(e.message ?: "Failed to fetch conditions")
            }
        }
    }
}
