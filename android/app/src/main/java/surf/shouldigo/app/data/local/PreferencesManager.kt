package surf.shouldigo.app.data.local

import android.content.SharedPreferences
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PreferencesManager @Inject constructor(
    private val prefs: SharedPreferences
) {
    var lastSelectedSpotId: String?
        get() = prefs.getString("last_selected_spot_id", null)
        set(value) = prefs.edit().putString("last_selected_spot_id", value).apply()

    var lastSelectedSpotName: String?
        get() = prefs.getString("last_selected_spot_name", null)
        set(value) = prefs.edit().putString("last_selected_spot_name", value).apply()

    var userWeight: String?
        get() = prefs.getString("user_weight", null)
        set(value) = prefs.edit().putString("user_weight", value).apply()

    var userSkill: String?
        get() = prefs.getString("user_skill", null)
        set(value) = prefs.edit().putString("user_skill", value).apply()
}
