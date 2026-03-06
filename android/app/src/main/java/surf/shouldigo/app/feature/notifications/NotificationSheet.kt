package surf.shouldigo.app.feature.notifications

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import surf.shouldigo.app.data.model.Spot
import surf.shouldigo.app.ui.theme.*

@Composable
fun NotificationSheet(
    spot: Spot,
    onDismiss: () -> Unit,
    viewModel: PushViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(spot.id) {
        viewModel.loadState(spot.id)
    }

    val thresholds = listOf(
        50 to "Fair or better",
        65 to "Good or better",
        75 to "Great or better",
        85 to "Epic only"
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(24.dp)
    ) {
        // Header
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(text = "\uD83D\uDD14", fontSize = 24.sp)
            Text(
                text = "Surf Alerts",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = PrimaryText
            )
        }

        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Get notified when ${spot.name} reaches your target score",
            fontSize = 14.sp,
            color = SecondaryText
        )

        if (!uiState.hasPermission) {
            Spacer(modifier = Modifier.height(12.dp))
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = ScoreFair.copy(alpha = 0.1f)
            ) {
                Text(
                    text = "Enable notifications in your device settings to receive alerts",
                    fontSize = 12.sp,
                    color = ScoreFair,
                    modifier = Modifier.padding(12.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Threshold selection
        Text(
            text = "Alert when score reaches:",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PrimaryText
        )
        Spacer(modifier = Modifier.height(8.dp))

        thresholds.forEach { (value, label) ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                RadioButton(
                    selected = uiState.threshold == value,
                    onClick = { viewModel.setThreshold(value) },
                    enabled = !uiState.isLoading
                )
                Column(modifier = Modifier.padding(start = 8.dp)) {
                    Text(text = "$value+", fontSize = 15.sp, fontWeight = FontWeight.Medium)
                    Text(text = label, fontSize = 12.sp, color = SecondaryText)
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Subscribe / Unsubscribe button
        if (uiState.isSubscribed) {
            OutlinedButton(
                onClick = { viewModel.unsubscribe(spot.id) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                enabled = !uiState.isLoading
            ) {
                Text("Remove Alert")
            }
        } else {
            val canSubscribe = uiState.subscriptionCount < 2
            Button(
                onClick = { viewModel.subscribe(spot.id, spot.name) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                enabled = !uiState.isLoading && canSubscribe
            ) {
                Text(if (uiState.isLoading) "Setting up..." else "Enable Alert")
            }
            if (!canSubscribe) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Maximum 2 spot alerts. Remove one first.",
                    fontSize = 12.sp,
                    color = SecondaryText
                )
            }
        }

        uiState.error?.let { error ->
            Spacer(modifier = Modifier.height(8.dp))
            Text(text = error, fontSize = 12.sp, color = ScoreFlat)
        }

        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Alerts are checked periodically and sent at most once every 6 hours per spot.",
            fontSize = 11.sp,
            color = SecondaryText
        )

        Spacer(modifier = Modifier.height(24.dp))
    }
}
