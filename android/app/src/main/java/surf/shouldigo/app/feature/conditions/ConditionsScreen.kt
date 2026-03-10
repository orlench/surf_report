package surf.shouldigo.app.feature.conditions

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import surf.shouldigo.app.data.model.ConditionsResponse
import surf.shouldigo.app.data.model.Spot
import surf.shouldigo.app.data.repository.FetchState
import surf.shouldigo.app.feature.conditions.components.*
import surf.shouldigo.app.ui.theme.Background
import surf.shouldigo.app.ui.theme.SecondaryText

@Composable
fun ConditionsScreen(
    spot: Spot,
    onConditionsLoaded: ((ConditionsResponse) -> Unit)? = null,
    viewModel: ConditionsViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()

    LaunchedEffect(spot.id) {
        viewModel.load(spot)
    }

    LaunchedEffect(state) {
        if (state is FetchState.Loaded) {
            onConditionsLoaded?.invoke((state as FetchState.Loaded).response)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Background)
    ) {
        when (val s = state) {
            is FetchState.Idle -> { /* Loading will start from LaunchedEffect */ }

            is FetchState.Streaming -> {
                FetchProgressScreen(steps = s.steps, spotName = spot.name)
            }

            is FetchState.Loaded -> {
                LoadedContent(
                    response = s.response,
                    isRefreshing = isRefreshing,
                    onRefresh = { viewModel.refresh(spot) },
                    savedWeight = viewModel.savedWeight,
                    savedSkill = viewModel.savedSkill,
                    onPersonalize = { w, s -> viewModel.personalize(w, s) }
                )
            }

            is FetchState.Error -> {
                ErrorContent(
                    message = s.message,
                    onRetry = { viewModel.refresh(spot) }
                )
            }
        }
    }
}

@Composable
private fun LoadedContent(
    response: ConditionsResponse,
    isRefreshing: Boolean = false,
    onRefresh: () -> Unit,
    savedWeight: String = "",
    savedSkill: String = "",
    onPersonalize: (weight: String?, skill: String?) -> Unit = { _, _ -> }
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        item {
            ScoreMeterCard(
                score = response.score,
                conditions = response.conditions,
                timestamp = response.timestamp,
                fromCache = response.fromCache,
                cacheAge = response.cacheAge,
                isRefreshing = isRefreshing,
                onRefresh = onRefresh
            )
        }

        response.score.breakdown?.let { breakdown ->
            item { BreakdownCard(breakdown = breakdown) }
        }

        response.trend?.let { trend ->
            if (!trend.blocks.isNullOrEmpty()) {
                item { ForecastCard(blocks = trend.blocks, trend = trend) }
            }
        }

        response.boardRecommendation?.let { board ->
            item {
                BoardCard(
                    recommendation = board,
                    conditions = response.conditions,
                    savedWeight = savedWeight,
                    savedSkill = savedSkill,
                    onPersonalize = onPersonalize
                )
            }
        }

        item {
            BeachSketchView(
                waveDirection = response.conditions.waves?.direction,
                windDirection = response.conditions.wind?.direction
            )
        }

        response.score.breakdown?.let { breakdown ->
            item { SpotFeedbackCard(spotId = response.spotId, breakdown = breakdown) }
        }

        item {
            Text(
                text = "Built between sessions by surfers who should've been in the water",
                style = MaterialTheme.typography.labelSmall,
                color = SecondaryText.copy(alpha = 0.5f),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }
    }
}

@Composable
private fun ErrorContent(
    message: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Couldn't fetch conditions",
            style = MaterialTheme.typography.titleLarge
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = SecondaryText
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onRetry) {
            Text("Try Again")
        }
    }
}
