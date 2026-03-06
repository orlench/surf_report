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

    fun isSubscribed(spotId: String): Boolean = subscriptionStore.isSubscribed(spotId)

    fun getSubscription(spotId: String) = subscriptionStore.getSubscription(spotId)

    fun subscriptionCount(): Int = subscriptionStore.count()
}
