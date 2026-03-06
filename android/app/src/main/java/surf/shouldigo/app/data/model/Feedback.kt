package surf.shouldigo.app.data.model

data class FeedbackRequest(
    val text: String
)

data class FeedbackResponse(
    val success: Boolean,
    val multipliers: Map<String, Double>? = null,
    val yourMultipliers: Map<String, Double>? = null,
    val feedbackCount: Int? = null
)

data class FeedbackListResponse(
    val feedbackCount: Int,
    val recentFeedback: List<RecentFeedback>? = null
)

data class RecentFeedback(
    val text: String
)
