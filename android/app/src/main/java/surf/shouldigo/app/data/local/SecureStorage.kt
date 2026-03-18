package surf.shouldigo.app.data.local

import android.content.SharedPreferences
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

@Singleton
class SecureStorage @Inject constructor(
    @Named("secure") private val prefs: SharedPreferences
) {
    private companion object {
        const val TOKEN_KEY = "fcm_token"
        const val PENDING_OLD_TOKEN_KEY = "pending_old_fcm_token"
        const val PENDING_NEW_TOKEN_KEY = "pending_new_fcm_token"
    }

    fun saveToken(token: String) {
        prefs.edit().putString(TOKEN_KEY, token).apply()
    }

    fun getToken(): String? = prefs.getString(TOKEN_KEY, null)

    fun savePendingTokenSync(oldToken: String, newToken: String) {
        prefs.edit()
            .putString(PENDING_OLD_TOKEN_KEY, oldToken)
            .putString(PENDING_NEW_TOKEN_KEY, newToken)
            .apply()
    }

    fun getPendingTokenSync(): Pair<String, String>? {
        val oldToken = prefs.getString(PENDING_OLD_TOKEN_KEY, null) ?: return null
        val newToken = prefs.getString(PENDING_NEW_TOKEN_KEY, null) ?: return null
        return oldToken to newToken
    }

    fun clearPendingTokenSync() {
        prefs.edit()
            .remove(PENDING_OLD_TOKEN_KEY)
            .remove(PENDING_NEW_TOKEN_KEY)
            .apply()
    }

    fun deleteToken() {
        prefs.edit().remove(TOKEN_KEY).apply()
    }
}
