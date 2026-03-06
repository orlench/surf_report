package surf.shouldigo.app.service

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import surf.shouldigo.app.MainActivity
import surf.shouldigo.app.R

class ShouldIGoMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Store token securely — will be picked up on next app launch
        getSharedPreferences("shouldigo_token_staging", MODE_PRIVATE)
            .edit()
            .putString("pending_fcm_token", token)
            .apply()
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
}
