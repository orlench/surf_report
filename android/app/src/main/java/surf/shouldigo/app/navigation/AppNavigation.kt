package surf.shouldigo.app.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import surf.shouldigo.app.data.model.Spot
import surf.shouldigo.app.feature.main.MainScreen
import surf.shouldigo.app.feature.map.SpotMapScreen

@Composable
fun AppNavigation(deepLinkSpotId: String? = null) {
    val navController = rememberNavController()
    // Hold the callback so the map result can reach MainScreen
    val mapCallback = remember { mutableStateOf<((Spot) -> Unit)?>(null) }

    NavHost(navController = navController, startDestination = Routes.Main.route) {
        composable(Routes.Main.route) {
            MainScreen(
                deepLinkSpotId = deepLinkSpotId,
                onOpenMap = { onSpotSelected ->
                    mapCallback.value = onSpotSelected
                    navController.navigate(Routes.Map.route)
                }
            )
        }

        composable(Routes.Map.route) {
            SpotMapScreen(
                onSpotSelected = { spot ->
                    navController.popBackStack()
                    mapCallback.value?.invoke(spot)
                    mapCallback.value = null
                },
                onBack = { navController.popBackStack() }
            )
        }
    }
}
