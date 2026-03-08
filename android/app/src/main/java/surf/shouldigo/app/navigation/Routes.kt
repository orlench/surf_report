package surf.shouldigo.app.navigation

sealed class Routes(val route: String) {
    data object Main : Routes("main")
    data object Map : Routes("map")
}
