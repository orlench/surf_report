package surf.shouldigo.app.feature.map

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.*
import surf.shouldigo.app.data.model.Spot
import surf.shouldigo.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SpotMapScreen(
    onSpotSelected: (Spot) -> Unit,
    onBack: () -> Unit,
    viewModel: SpotMapViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(LatLng(32.0, 34.8), 3f)
    }

    var visibleSpots by remember { mutableStateOf<List<Spot>>(emptyList()) }
    var mapLoaded by remember { mutableStateOf(false) }

    // Show all spots once map is loaded, then filter on camera move
    LaunchedEffect(mapLoaded, cameraPositionState.isMoving) {
        if (mapLoaded && !cameraPositionState.isMoving) {
            val bounds = cameraPositionState.projection?.visibleRegion?.latLngBounds
            visibleSpots = if (bounds != null) {
                viewModel.visibleSpots(bounds)
            } else {
                // Fallback: show all spots if projection not ready yet
                uiState.allSpots
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        GoogleMap(
            modifier = Modifier.fillMaxSize(),
            cameraPositionState = cameraPositionState,
            uiSettings = MapUiSettings(
                zoomControlsEnabled = false,
                myLocationButtonEnabled = false
            ),
            onMapLoaded = { mapLoaded = true }
        ) {
            visibleSpots.forEach { spot ->
                spot.location?.let { loc ->
                    Marker(
                        state = MarkerState(position = LatLng(loc.lat, loc.lon)),
                        title = spot.name,
                        snippet = spot.country,
                        onClick = {
                            viewModel.selectSpot(spot)
                            false
                        }
                    )
                }
            }
        }

        // Search overlay
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .statusBarsPadding()
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                }
                OutlinedTextField(
                    value = uiState.searchText,
                    onValueChange = { viewModel.updateSearch(it) },
                    placeholder = { Text("Search surf spots...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedContainerColor = CardBackground,
                        focusedContainerColor = CardBackground
                    )
                )
            }

            // Search results dropdown
            if (uiState.searchResults.isNotEmpty()) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    tonalElevation = 4.dp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 300.dp)
                ) {
                    LazyColumn {
                        items(uiState.searchResults) { spot ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        viewModel.selectSpot(spot)
                                        viewModel.updateSearch("")
                                        spot.location?.let { loc ->
                                            cameraPositionState.move(
                                                CameraUpdateFactory.newLatLngZoom(
                                                    LatLng(loc.lat, loc.lon), 12f
                                                )
                                            )
                                        }
                                    }
                                    .padding(12.dp)
                            ) {
                                Column {
                                    Text(spot.name, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                                    Text(spot.country, fontSize = 12.sp, color = SecondaryText)
                                }
                            }
                        }
                    }
                }
            }
        }

        // Selected spot bottom card
        uiState.selectedSpot?.let { spot ->
            Surface(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(16.dp),
                shape = RoundedCornerShape(16.dp),
                tonalElevation = 8.dp
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(spot.name, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                    if (spot.country.isNotEmpty()) {
                        Text(spot.country, fontSize = 14.sp, color = SecondaryText)
                    }
                    spot.location?.let { loc ->
                        Text(
                            "%.4f, %.4f".format(loc.lat, loc.lon),
                            fontSize = 12.sp,
                            color = SecondaryText
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = { onSpotSelected(spot) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("Check conditions")
                    }
                }
            }
        }
    }
}
