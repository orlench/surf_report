package surf.shouldigo.app.data.repository

import surf.shouldigo.app.data.local.SecureStorage
import surf.shouldigo.app.data.local.StoredSubscription
import surf.shouldigo.app.data.local.SubscriptionStore
import surf.shouldigo.app.data.model.PushSubscribeRequest
import surf.shouldigo.app.data.model.PushUnsubscribeRequest
import surf.shouldigo.app.data.remote.ApiService
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PushRepository @Inject constructor(
    private val api: ApiService,
    private val secureStorage: SecureStorage,
    private val subscriptionStore: SubscriptionStore
) {
    suspend fun subscribe(spotId: String, spotName: String, threshold: Int): Boolean {
        syncPendingTokenIfNeeded()
        val token = secureStorage.getToken() ?: return false
        val response = api.subscribePush(
            PushSubscribeRequest(
                type = "fcm",
                token = token,
                spotId = spotId,
                threshold = threshold
            )
        )
        if (response.success) {
            subscriptionStore.save(StoredSubscription(spotId, spotName, threshold))
        }
        return response.success
    }

    suspend fun unsubscribe(spotId: String): Boolean {
        syncPendingTokenIfNeeded()
        val token = secureStorage.getToken() ?: return false
        val response = api.unsubscribePush(
            PushUnsubscribeRequest(
                token = token,
                spotId = spotId,
                type = "fcm"
            )
        )
        if (response.success) {
            subscriptionStore.remove(spotId)
        }
        return response.success
    }

    suspend fun syncPendingTokenIfNeeded(): Boolean {
        val (oldToken, newToken) = secureStorage.getPendingTokenSync() ?: return true
        val subscriptions = subscriptionStore.all()

        if (subscriptions.isEmpty()) {
            secureStorage.clearPendingTokenSync()
            return true
        }

        var allSucceeded = true

        for (subscription in subscriptions) {
            try {
                val subscribeResponse = api.subscribePush(
                    PushSubscribeRequest(
                        type = "fcm",
                        token = newToken,
                        spotId = subscription.spotId,
                        threshold = subscription.threshold
                    )
                )

                if (!subscribeResponse.success) {
                    allSucceeded = false
                    continue
                }

                if (oldToken != newToken) {
                    runCatching {
                        api.unsubscribePush(
                            PushUnsubscribeRequest(
                                token = oldToken,
                                spotId = subscription.spotId,
                                type = "fcm"
                            )
                        )
                    }
                }
            } catch (_: Exception) {
                allSucceeded = false
            }
        }

        if (allSucceeded) {
            secureStorage.clearPendingTokenSync()
        }

        return allSucceeded
    }

    fun isSubscribed(spotId: String): Boolean = subscriptionStore.isSubscribed(spotId)

    fun getSubscription(spotId: String) = subscriptionStore.getSubscription(spotId)

    fun subscriptionCount(): Int = subscriptionStore.count()
}
