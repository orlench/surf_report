package surf.shouldigo.app.data.local

import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import javax.inject.Inject
import javax.inject.Singleton

data class StoredSubscription(
    val spotId: String,
    val spotName: String,
    val threshold: Int
)

@Singleton
class SubscriptionStore @Inject constructor(
    private val prefs: SharedPreferences,
    private val gson: Gson
) {
    private val key = "push_subscriptions"

    fun all(): List<StoredSubscription> {
        val json = prefs.getString(key, null) ?: return emptyList()
        val type = object : TypeToken<List<StoredSubscription>>() {}.type
        return gson.fromJson(json, type)
    }

    fun isSubscribed(spotId: String): Boolean = all().any { it.spotId == spotId }

    fun getSubscription(spotId: String): StoredSubscription? = all().find { it.spotId == spotId }

    fun save(sub: StoredSubscription) {
        val list = all().toMutableList()
        list.removeAll { it.spotId == sub.spotId }
        list.add(sub)
        prefs.edit().putString(key, gson.toJson(list)).apply()
    }

    fun remove(spotId: String) {
        val list = all().toMutableList()
        list.removeAll { it.spotId == spotId }
        prefs.edit().putString(key, gson.toJson(list)).apply()
    }

    fun count(): Int = all().size
}
