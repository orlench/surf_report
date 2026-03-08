package surf.shouldigo.app.data.model

sealed class SSEEvent {
    data class Start(val spotId: String, val spotName: String) : SSEEvent()

    data class Progress(
        val source: String,
        val status: String,
        val label: String? = null,
        val completed: Int? = null,
        val total: Int? = null
    ) : SSEEvent()

    data class Complete(val response: ConditionsResponse) : SSEEvent()

    data class Error(val message: String) : SSEEvent()
}
