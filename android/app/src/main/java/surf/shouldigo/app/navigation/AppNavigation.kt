package surf.shouldigo.app.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import surf.shouldigo.app.feature.main.MainScreen
import surf.shouldigo.app.feature.map.SpotMapScreen

@Composable
fun AppNavigation(deepLinkSpotId: String? = null) {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = Routes.Main.route) {
        composable(Routes.Main.route) {
            MainScreen(
                deepLinkSpotId = deepLinkSpotId,
                onOpenMap = { onSpotSelected ->
                    navController.currentBackStackEntry
                        ?.savedStateHandle
                        ?.set("mapCallback", true)
                    navController.navigate(Routes.Map.route)
                }
            )
        }

        composable(Routes.Map.route) {
            SpotMapScreen(
                onSpotSelected = { spot ->
                    navController.previousBackStackEntry
                        ?.savedStateHandle
                        ?.set("selectedSpotId", spot.id)
                    navController.previousBackStackEntry
                        ?.savedStateHandle
                        ?.set("selectedSpotName", spot.name)
                    navController.previousBackStackEntry
                        ?.savedStateHandle
                        ?.set("selectedSpotCountry", spot.country)
                    navController.previousBackStackEntry
                        ?.savedStateHandle
                        ?.set("selectedSpotLat", spot.lat)
                    navController.previousBackStackEntry
                        ?.savedStateHandle
                        ?.set("selectedSpotLon", spot.lon)
                    navController.popBackStack()
                },
                onBack = { navController.popBackStack() }
            )
        }
    }
}
