package surf.shouldigo.app.feature.conditions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import surf.shouldigo.app.data.local.CustomSpotStore
import surf.shouldigo.app.data.local.PreferencesManager
import surf.shouldigo.app.data.local.SpotDataSource
import surf.shouldigo.app.data.model.Spot
import surf.shouldigo.app.data.repository.ConditionsRepository
import surf.shouldigo.app.data.repository.FetchState
import surf.shouldigo.app.data.repository.ProgressStep
import surf.shouldigo.app.data.repository.SpotRepository
import javax.inject.Inject

@HiltViewModel
class ConditionsViewModel @Inject constructor(
    private val conditionsRepo: ConditionsRepository,
    private val spotRepo: SpotRepository,
    private val customSpotStore: CustomSpotStore,
    private val spotDataSource: SpotDataSource,
    private val prefs: PreferencesManager
) : ViewModel() {

    private val _state = MutableStateFlow<FetchState>(FetchState.Idle)
    val state: StateFlow<FetchState> = _state

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing

    private val _isPersonalizing = MutableStateFlow(false)
    val isPersonalizing: StateFlow<Boolean> = _isPersonalizing

    val savedWeight: String get() = prefs.userWeight ?: ""
    val savedSkill: String get() = prefs.userSkill ?: ""

    private var currentSpotId: String? = null
    private var currentSpot: Spot? = null
    private var loadJob: Job? = null
    private var personalizationJob: Job? = null
    private var personalizationRevision = 0

    fun load(spot: Spot) {
        if (currentSpotId == spot.id && _state.value is FetchState.Loaded) return

        currentSpotId = spot.id
        currentSpot = spot
        loadJob?.cancel()
        personalizationJob?.cancel()
        _isPersonalizing.value = false

        // Check if custom spot
        val customMeta = customSpotStore.find(spot.id)
        if (customMeta != null) {
            loadCustomSpot(customMeta)
            return
        }

        // Spot picked from the map with coordinates — use custom endpoint
        val loc = spot.location
        if (loc != null) {
            loadJob = viewModelScope.launch {
                _state.value = FetchState.Streaming(
                    listOf(ProgressStep("fetch", "Fetching conditions...", "loading"))
                )
                try {
                    val response = conditionsRepo.fetchCustomConditions(
                        loc.lat, loc.lon, spot.name, spot.country.ifEmpty { null }
                    )
                    _state.value = FetchState.Loaded(response)
                } catch (e: Exception) {
                    _state.value = FetchState.Error(e.message ?: "Failed to fetch conditions")
                }
            }
            return
        }

        if (conditionsRepo.hasPersonalization()) {
            loadJob = viewModelScope.launch {
                _state.value = FetchState.Streaming(
                    listOf(ProgressStep("fetch", "Applying your gear profile...", "loading"))
                )
                try {
                    val response = conditionsRepo.fetchViaREST(spot.id)
                    _state.value = FetchState.Loaded(response)
                } catch (e: Exception) {
                    _state.value = FetchState.Error(e.message ?: "Failed to fetch conditions")
                }
            }
            return
        }

        loadJob = viewModelScope.launch {
            conditionsRepo.streamConditions(spot.id).collect { fetchState ->
                _state.value = fetchState
            }
            // If stream ended with an error, try fallback via coordinates from local DB
            if (_state.value is FetchState.Error) {
                val localSpot = spotDataSource.loadAllSpots().find { it.id == spot.id }
                if (localSpot?.location != null) {
                    try {
                        val response = conditionsRepo.fetchCustomConditions(
                            localSpot.location.lat, localSpot.location.lon,
                            spot.name, localSpot.country.ifEmpty { null }
                        )
                        _state.value = FetchState.Loaded(response)
                    } catch (_: Exception) {
                        // Keep the original error
                    }
                }
            }
        }
    }

    fun refresh(spot: Spot) {
        val customMeta = customSpotStore.find(spot.id)
        personalizationJob?.cancel()
        _isPersonalizing.value = false
        viewModelScope.launch {
            _isRefreshing.value = true
            try {
                val response = if (customMeta != null) {
                    conditionsRepo.fetchCustomConditions(
                        customMeta.lat, customMeta.lon, customMeta.name, customMeta.country
                    )
                } else if (spot.location != null) {
                    conditionsRepo.fetchCustomConditions(
                        spot.location.lat, spot.location.lon, spot.name, spot.country.ifEmpty { null }
                    )
                } else {
                    conditionsRepo.fetchViaREST(spot.id)
                }
                currentSpotId = spot.id
                _state.value = FetchState.Loaded(response)
            } catch (e: Exception) {
                _state.value = FetchState.Error(e.message ?: "Failed to refresh")
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    fun personalize(weight: String?, skill: String?) {
        prefs.userWeight = weight
        prefs.userSkill = skill
        val spot = currentSpot ?: return

        personalizationRevision += 1
        val revision = personalizationRevision
        personalizationJob?.cancel()

        // "Kook" is a local-only mode on mobile; update the card immediately without refetching.
        if (skill == "kook") {
            _isPersonalizing.value = false
            return
        }

        personalizationJob = viewModelScope.launch(Dispatchers.Main) {
            _isPersonalizing.value = true

            try {
                // Let the UI settle after dropdown/text interactions before refetching.
                delay(250)

                val response = when {
                    customSpotStore.find(spot.id) != null -> {
                        val customMeta = customSpotStore.find(spot.id)!!
                        conditionsRepo.fetchCustomConditions(
                            customMeta.lat,
                            customMeta.lon,
                            customMeta.name,
                            customMeta.country
                        )
                    }
                    spot.location != null -> {
                        conditionsRepo.fetchCustomConditions(
                            spot.location.lat,
                            spot.location.lon,
                            spot.name,
                            spot.country.ifEmpty { null }
                        )
                    }
                    else -> {
                        conditionsRepo.fetchViaREST(spot.id)
                    }
                }

                if (revision == personalizationRevision && currentSpotId == spot.id) {
                    _state.value = FetchState.Loaded(response)
                }
            } catch (_: Exception) {
                // Keep the current loaded content visible if personalization refresh fails.
            } finally {
                if (revision == personalizationRevision) {
                    _isPersonalizing.value = false
                }
            }
        }
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
