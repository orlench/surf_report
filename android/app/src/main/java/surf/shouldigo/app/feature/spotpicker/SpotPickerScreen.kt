package surf.shouldigo.app.feature.spotpicker

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import surf.shouldigo.app.data.model.Spot
import surf.shouldigo.app.ui.theme.*

@Composable
fun SpotPickerScreen(
    onSpotSelected: (Spot) -> Unit,
    onOpenMap: () -> Unit,
    viewModel: SpotPickerViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(modifier = Modifier.fillMaxHeight(0.85f)) {
        // Search bar
        OutlinedTextField(
            value = uiState.searchText,
            onValueChange = { viewModel.updateSearch(it) },
            placeholder = { Text("Search spots...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            trailingIcon = {
                IconButton(onClick = onOpenMap) {
                    Icon(Icons.Default.Map, contentDescription = "Open map", tint = Accent)
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            singleLine = true,
            shape = RoundedCornerShape(12.dp)
        )

        LazyColumn(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            // Nearby spots
            if (uiState.nearbySpots.isNotEmpty() && uiState.searchText.isEmpty()) {
                item {
                    Text(
                        text = "Near you",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = SecondaryText,
                        modifier = Modifier.padding(vertical = 8.dp)
                    )
                }
                items(uiState.nearbySpots) { nearby ->
                    SpotRow(
                        name = nearby.name,
                        subtitle = buildString {
                            append(nearby.country)
                            nearby.distance?.let { append(" \u2022 ${it.toInt()} km") }
                        },
                        onClick = {
                            onSpotSelected(Spot(id = nearby.id, name = nearby.name, country = nearby.country))
                        }
                    )
                }
            }

            // Recent custom spots
            if (uiState.recentCustomSpots.isNotEmpty() && uiState.searchText.isEmpty()) {
                item {
                    Text(
                        text = "Recent",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = SecondaryText,
                        modifier = Modifier.padding(vertical = 8.dp)
                    )
                }
                items(uiState.recentCustomSpots) { custom ->
                    SpotRow(
                        name = custom.name,
                        subtitle = custom.country ?: "Custom spot",
                        onClick = {
                            onSpotSelected(Spot(id = custom.id, name = custom.name, country = custom.country ?: ""))
                        }
                    )
                }
            }

            // Grouped by country
            uiState.groupedSpots.forEach { (country, spots) ->
                item {
                    Text(
                        text = country,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = SecondaryText,
                        modifier = Modifier.padding(vertical = 8.dp, horizontal = 4.dp)
                    )
                }
                items(spots, key = { it.id }) { spot ->
                    SpotRow(
                        name = spot.name,
                        subtitle = spot.region ?: "",
                        onClick = { onSpotSelected(spot) }
                    )
                }
            }
        }
    }
}

@Composable
private fun SpotRow(name: String, subtitle: String, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        color = Background
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = name,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = PrimaryText
            )
            if (subtitle.isNotEmpty()) {
                Text(
                    text = subtitle,
                    fontSize = 12.sp,
                    color = SecondaryText
                )
            }
        }
    }
}
