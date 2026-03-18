package surf.shouldigo.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import surf.shouldigo.app.data.repository.PushRepository
import javax.inject.Inject

@HiltAndroidApp
class ShouldIGoApp : Application() {
    @Inject lateinit var pushRepository: PushRepository

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        appScope.launch {
            pushRepository.syncPendingTokenIfNeeded()
        }
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
