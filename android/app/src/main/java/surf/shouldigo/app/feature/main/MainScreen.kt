package surf.shouldigo.app.feature.main

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import surf.shouldigo.app.data.model.ConditionsResponse
import surf.shouldigo.app.data.model.Spot
import surf.shouldigo.app.feature.conditions.ConditionsScreen
import surf.shouldigo.app.feature.notifications.NotificationSheet
import surf.shouldigo.app.feature.spotpicker.SpotPickerScreen
import surf.shouldigo.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    deepLinkSpotId: String? = null,
    onOpenMap: ((onSpotSelected: (Spot) -> Unit) -> Unit)? = null,
    viewModel: MainViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showSpotPicker by remember { mutableStateOf(false) }
    var showNotificationSheet by remember { mutableStateOf(false) }
    var loadedConditions by remember { mutableStateOf<ConditionsResponse?>(null) }
    val context = LocalContext.current

    LaunchedEffect(deepLinkSpotId) {
        deepLinkSpotId?.let { viewModel.handleDeepLink(it) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = uiState.selectedSpot?.name ?: "Should I Go?",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 18.sp
                    )
                },
                actions = {
                    loadedConditions?.let { response ->
                        IconButton(onClick = {
                            val spot = uiState.selectedSpot ?: return@IconButton
                            val text = buildShareText(spot, response)
                            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                                putExtra(Intent.EXTRA_TEXT, text)
                                type = "text/plain"
                            }
                            context.startActivity(Intent.createChooser(sendIntent, "Share surf conditions"))
                        }) {
                            Icon(Icons.Default.Share, contentDescription = "Share", tint = Accent)
                        }
                    }
                    IconButton(onClick = { showSpotPicker = true }) {
                        Icon(Icons.Default.LocationOn, contentDescription = "Change spot", tint = Accent)
                    }
                    uiState.selectedSpot?.let {
                        IconButton(onClick = { showNotificationSheet = true }) {
                            Icon(Icons.Outlined.Notifications, contentDescription = "Alerts", tint = Accent)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Background
                )
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(Background)
        ) {
            when {
                uiState.isAutoDetecting -> {
                    DetectingView()
                }
                uiState.selectedSpot != null -> {
                    ConditionsScreen(
                        spot = uiState.selectedSpot!!,
                        onConditionsLoaded = { loadedConditions = it }
                    )
                }
                else -> {
                    SplashView(onFindSpot = { showSpotPicker = true })
                }
            }
        }
    }

    // Spot picker bottom sheet
    if (showSpotPicker) {
        ModalBottomSheet(
            onDismissRequest = { showSpotPicker = false },
            containerColor = CardBackground
        ) {
            SpotPickerScreen(
                onSpotSelected = { spot ->
                    viewModel.selectSpot(spot)
                    showSpotPicker = false
                },
                onOpenMap = {
                    showSpotPicker = false
                    // TODO: navigate to map
                }
            )
        }
    }

    // Notification sheet
    if (showNotificationSheet) {
        ModalBottomSheet(
            onDismissRequest = { showNotificationSheet = false },
            containerColor = CardBackground
        ) {
            uiState.selectedSpot?.let { spot ->
                NotificationSheet(
                    spot = spot,
                    onDismiss = { showNotificationSheet = false }
                )
            }
        }
    }
}

@Composable
private fun DetectingView() {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator(color = Accent)
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Finding your nearest break...",
            fontSize = 16.sp,
            color = SecondaryText
        )
    }
}

private fun buildShareText(spot: Spot, response: ConditionsResponse): String {
    val score = response.score.overall
    val rating = response.score.rating
    val c = response.conditions
    val parts = mutableListOf<String>()
    val mn = c.waves?.height?.min
    val mx = c.waves?.height?.max
    val avg = c.waves?.height?.avg
    if (mn != null && mx != null) {
        parts.add("Waves: ${"%.1f".format(mn)}–${"%.1f".format(mx)}m")
    } else if (avg != null) {
        parts.add("Waves: ${"%.1f".format(avg)}m")
    }
    c.wind?.speed?.let { ws ->
        var w = "Wind: ${ws.toInt()} km/h"
        c.wind?.direction?.let { wd -> w += " $wd" }
        parts.add(w)
    }
    c.weather?.waterTemp?.let { wt ->
        parts.add("Water: ${wt.toInt()}°C")
    }
    val details = parts.joinToString(" | ")
    val url = "https://shouldigo.surf?spot=${spot.id}"
    return "Should I Go? \uD83C\uDFC4 ${spot.name} — $score/100 ($rating)\n$details\nCheck it out: $url"
}

@Composable
private fun SplashView(onFindSpot: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(text = "\uD83C\uDFC4", fontSize = 64.sp)
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Should I Go?",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = PrimaryText
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Real-time surf conditions for any beach",
            fontSize = 14.sp,
            color = SecondaryText
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onFindSpot) {
            Text("Find a Spot")
        }
    }
}
