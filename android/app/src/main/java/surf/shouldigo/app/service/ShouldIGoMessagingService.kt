package surf.shouldigo.app.service

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import surf.shouldigo.app.MainActivity
import surf.shouldigo.app.R
import surf.shouldigo.app.data.local.SecureStorage
import surf.shouldigo.app.data.repository.PushRepository
import javax.inject.Inject

@AndroidEntryPoint
class ShouldIGoMessagingService : FirebaseMessagingService() {
    @Inject lateinit var secureStorage: SecureStorage
    @Inject lateinit var pushRepository: PushRepository

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val previousToken = secureStorage.getToken()
        secureStorage.saveToken(token)

        if (!previousToken.isNullOrBlank() && previousToken != token) {
            secureStorage.savePendingTokenSync(previousToken, token)
            serviceScope.launch {
                pushRepository.syncPendingTokenIfNeeded()
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val title = message.notification?.title ?: message.data["title"] ?: "Surf Alert"
        val body = message.notification?.body ?: message.data["body"] ?: "Conditions are looking good!"
        val url = message.data["url"]

        // Extract spotId from URL (e.g., "/?spot=pipeline")
        val spotId = url?.substringAfter("spot=", "")?.takeIf { it.isNotEmpty() }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            spotId?.let { putExtra("spotId", it) }
        }

        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, "surf_alerts")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }
}
