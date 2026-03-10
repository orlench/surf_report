package surf.shouldigo.app.feature.main

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import surf.shouldigo.app.data.local.PreferencesManager
import surf.shouldigo.app.data.model.NearbySpot
import surf.shouldigo.app.data.model.Spot
import surf.shouldigo.app.data.repository.SpotRepository
import javax.inject.Inject

data class MainUiState(
    val selectedSpot: Spot? = null,
    val isAutoDetecting: Boolean = false,
    val nearbySpots: List<NearbySpot> = emptyList(),
    val needsLocationPermission: Boolean = false
)

@HiltViewModel
class MainViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
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
            // Check if we have location permission already
            if (hasLocationPermission()) {
                autoDetect()
            } else {
                _uiState.value = _uiState.value.copy(needsLocationPermission = true)
            }
        }
    }

    private fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
    }

    fun onLocationPermissionResult(granted: Boolean) {
        _uiState.value = _uiState.value.copy(needsLocationPermission = false)
        autoDetect()
    }

    fun autoDetect() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isAutoDetecting = true, needsLocationPermission = false)
            try {
                var lat: Double? = null
                var lon: Double? = null

                // Try to get GPS coordinates if we have permission
                if (hasLocationPermission()) {
                    try {
                        val fusedClient = LocationServices.getFusedLocationProviderClient(context)
                        val location = fusedClient.getCurrentLocation(
                            Priority.PRIORITY_BALANCED_POWER_ACCURACY,
                            CancellationTokenSource().token
                        ).await()
                        if (location != null) {
                            lat = location.latitude
                            lon = location.longitude
                        }
                    } catch (_: SecurityException) {
                        // Permission revoked between check and use
                    } catch (_: Exception) {
                        // GPS failed, fall back to IP-based
                    }
                }

                val response = spotRepo.fetchNearestSpot(lat, lon)
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

    fun selectSpot(spot: Spot) {
        _uiState.value = _uiState.value.copy(selectedSpot = spot)
        prefs.lastSelectedSpotId = spot.id
        prefs.lastSelectedSpotName = spot.name
    }

    fun handleDeepLink(spotId: String) {
        selectSpot(Spot(id = spotId, name = spotId.replace("_", " ").replaceFirstChar { it.uppercase() }))
    }
}
