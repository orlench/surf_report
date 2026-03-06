package surf.shouldigo.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class ShouldIGoApp : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            "surf_alerts",
            "Surf Alerts",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifications when surf conditions reach your target score"
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }
}
