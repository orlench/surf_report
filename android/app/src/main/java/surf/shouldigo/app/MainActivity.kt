package surf.shouldigo.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import dagger.hilt.android.AndroidEntryPoint
import surf.shouldigo.app.navigation.AppNavigation
import surf.shouldigo.app.ui.theme.ShouldIGoTheme

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val deepLinkSpotId = intent?.getStringExtra("spotId")

        setContent {
            ShouldIGoTheme {
                AppNavigation(deepLinkSpotId = deepLinkSpotId)
            }
        }
    }
}
