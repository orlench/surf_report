package surf.shouldigo.app.data.local

import android.content.SharedPreferences
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

@Singleton
class SecureStorage @Inject constructor(
    @Named("secure") private val prefs: SharedPreferences
) {
    fun saveToken(token: String) {
        prefs.edit().putString("fcm_token", token).apply()
    }

    fun getToken(): String? = prefs.getString("fcm_token", null)

    fun deleteToken() {
        prefs.edit().remove("fcm_token").apply()
    }
}
