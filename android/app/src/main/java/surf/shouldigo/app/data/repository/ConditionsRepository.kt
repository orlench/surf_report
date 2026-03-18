package surf.shouldigo.app.data.repository

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import surf.shouldigo.app.data.model.ConditionsResponse
import surf.shouldigo.app.data.model.SSEEvent
import surf.shouldigo.app.data.local.PreferencesManager
import surf.shouldigo.app.data.remote.ApiService
import surf.shouldigo.app.data.remote.SSEClient
import javax.inject.Inject
import javax.inject.Singleton

sealed class FetchState {
    data object Idle : FetchState()
    data class Streaming(val steps: List<ProgressStep>) : FetchState()
    data class Loaded(val response: ConditionsResponse) : FetchState()
    data class Error(val message: String) : FetchState()
}

data class ProgressStep(
    val source: String,
    val label: String,
    val status: String // "loading", "success", "failed"
)

@Singleton
class ConditionsRepository @Inject constructor(
    private val api: ApiService,
    private val sseClient: SSEClient,
    private val prefs: PreferencesManager
) {
    private val validSkills = setOf("beginner", "intermediate", "advanced", "expert")

    fun streamConditions(spotId: String): Flow<FetchState> = flow {
        emit(FetchState.Idle)

        val steps = mutableListOf<ProgressStep>()
        var completed = false

        try {
            sseClient.connect(spotId).collect { event ->
                when (event) {
                    is SSEEvent.Start -> {
                        emit(FetchState.Streaming(steps.toList()))
                    }
                    is SSEEvent.Progress -> {
                        steps.add(
                            ProgressStep(
                                source = event.source,
                                label = event.label ?: event.source,
                                status = event.status
                            )
                        )
                        emit(FetchState.Streaming(steps.toList()))
                    }
                    is SSEEvent.Complete -> {
                        completed = true
                        emit(FetchState.Loaded(event.response))
                    }
                    is SSEEvent.Error -> {
                        if (!completed) {
                            // Silently fallback to REST — don't show SSE error to user
                            try {
                                val response = fetchViaREST(spotId)
                                emit(FetchState.Loaded(response))
                                completed = true
                            } catch (e: Exception) {
                                emit(FetchState.Error(e.message ?: "Failed to fetch conditions"))
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            if (!completed) {
                // SSE failed entirely, fallback to REST
                try {
                    val response = fetchViaREST(spotId)
                    emit(FetchState.Loaded(response))
                } catch (restError: Exception) {
                    emit(FetchState.Error(restError.message ?: "Failed to fetch conditions"))
                }
            }
        }
    }

    fun hasPersonalization(): Boolean = sanitizedWeight() != null || sanitizedSkill() != null

    suspend fun fetchViaREST(spotId: String): ConditionsResponse {
        val weight = sanitizedWeight()
        val skill = sanitizedSkill()
        return api.fetchConditions(spotId, weight, skill)
    }

    suspend fun fetchCustomConditions(
        lat: Double,
        lon: Double,
        name: String,
        country: String?
    ): ConditionsResponse {
        return api.fetchCustomConditions(
            lat = lat,
            lon = lon,
            name = name,
            country = country,
            weight = sanitizedWeight(),
            skill = sanitizedSkill()
        )
    }

    private fun sanitizedWeight(): String? {
        val weight = prefs.userWeight?.toIntOrNull() ?: return null
        return weight.takeIf { it in 20..250 }?.toString()
    }

    private fun sanitizedSkill(): String? {
        val skill = prefs.userSkill ?: return null
        return skill.takeIf { validSkills.contains(it) }
    }
}
