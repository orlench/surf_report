package surf.shouldigo.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = Accent,
    onPrimary = Color.White,
    secondary = ScoreGood,
    background = Background,
    surface = CardBackground,
    onBackground = PrimaryText,
    onSurface = PrimaryText,
    surfaceVariant = Color(0xFFF0F0F5),
    outline = Color(0xFFE5E7EB)
)

@Composable
fun ShouldIGoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = Typography,
        content = content
    )
}
