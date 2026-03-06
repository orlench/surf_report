package surf.shouldigo.app.data.local

import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import surf.shouldigo.app.data.model.CustomSpotMeta
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CustomSpotStore @Inject constructor(
    private val prefs: SharedPreferences,
    private val gson: Gson
) {
    private val key = "custom_spots"
    private val maxSpots = 20

    fun all(): List<CustomSpotMeta> {
        val json = prefs.getString(key, null) ?: return emptyList()
        val type = object : TypeToken<List<CustomSpotMeta>>() {}.type
        return gson.fromJson(json, type)
    }

    fun recent(limit: Int = 5): List<CustomSpotMeta> = all().takeLast(limit).reversed()

    fun find(id: String): CustomSpotMeta? = all().find { it.id == id }

    fun save(meta: CustomSpotMeta) {
        val list = all().toMutableList()
        list.removeAll { it.id == meta.id }
        list.add(meta)
        if (list.size > maxSpots) {
            list.removeAt(0)
        }
        prefs.edit().putString(key, gson.toJson(list)).apply()
    }
}
