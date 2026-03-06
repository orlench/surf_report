package surf.shouldigo.app.data.model

data class PushSubscribeRequest(
    val type: String = "fcm",
    val token: String,
    val spotId: String,
    val threshold: Int
)

data class PushSubscribeResponse(
    val success: Boolean,
    val id: String? = null,
    val count: Int? = null,
    val error: String? = null
)

data class PushUnsubscribeRequest(
    val token: String,
    val spotId: String,
    val type: String = "fcm"
)

data class GenericResponse(
    val success: Boolean,
    val error: String? = null
)
