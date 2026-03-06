package surf.shouldigo.app.data.remote

import com.google.gson.Gson
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import surf.shouldigo.app.data.model.ConditionsResponse
import surf.shouldigo.app.data.model.SSEEvent
import javax.inject.Inject

class SSEClient @Inject constructor(
    private val client: OkHttpClient,
    private val gson: Gson,
    private val baseUrl: String
) {
    fun connect(spotId: String): Flow<SSEEvent> = callbackFlow {
        val request = Request.Builder()
            .url("${baseUrl}conditions/${spotId}/stream")
            .header("Accept", "text/event-stream")
            .build()

        val factory = EventSources.createFactory(client)

        val listener = object : EventSourceListener() {
            override fun onEvent(
                eventSource: EventSource,
                id: String?,
                type: String?,
                data: String
            ) {
                val event = when (type) {
                    "start" -> {
                        try {
                            val parsed = gson.fromJson(data, SSEStartData::class.java)
                            SSEEvent.Start(parsed.spotId, parsed.spotName)
                        } catch (e: Exception) {
                            null
                        }
                    }
                    "progress" -> {
                        try {
                            val parsed = gson.fromJson(data, SSEProgressData::class.java)
                            SSEEvent.Progress(
                                source = parsed.name ?: parsed.type ?: "unknown",
                                status = if (parsed.success == true) "success" else "failed",
                                label = parsed.label,
                                completed = parsed.completed,
                                total = parsed.total
                            )
                        } catch (e: Exception) {
                            null
                        }
                    }
                    "complete" -> {
                        try {
                            val response = gson.fromJson(data, ConditionsResponse::class.java)
                            SSEEvent.Complete(response)
                        } catch (e: Exception) {
                            SSEEvent.Error("Failed to parse conditions: ${e.message}")
                        }
                    }
                    "error" -> {
                        try {
                            val parsed = gson.fromJson(data, SSEErrorData::class.java)
                            SSEEvent.Error(parsed.message ?: "Unknown error")
                        } catch (e: Exception) {
                            SSEEvent.Error("Unknown error")
                        }
                    }
                    else -> null
                }
                event?.let { trySend(it) }
            }

            override fun onFailure(
                eventSource: EventSource,
                t: Throwable?,
                response: Response?
            ) {
                trySend(SSEEvent.Error(t?.message ?: "SSE connection failed"))
                close()
            }

            override fun onClosed(eventSource: EventSource) {
                close()
            }
        }

        val eventSource = factory.newEventSource(request, listener)

        awaitClose {
            eventSource.cancel()
        }
    }

    // Internal data classes for parsing SSE JSON payloads
    private data class SSEStartData(val spotId: String, val spotName: String)
    private data class SSEProgressData(
        val type: String? = null,
        val name: String? = null,
        val label: String? = null,
        val success: Boolean? = null,
        val completed: Int? = null,
        val total: Int? = null
    )
    private data class SSEErrorData(val message: String? = null)
}
