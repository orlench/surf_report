package surf.shouldigo.app.data.repository

import surf.shouldigo.app.data.model.FeedbackListResponse
import surf.shouldigo.app.data.model.FeedbackRequest
import surf.shouldigo.app.data.model.FeedbackResponse
import surf.shouldigo.app.data.remote.ApiService
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FeedbackRepository @Inject constructor(
    private val api: ApiService
) {
    suspend fun fetchFeedback(spotId: String): FeedbackListResponse {
        return api.fetchFeedback(spotId)
    }

    suspend fun submitFeedback(spotId: String, text: String): FeedbackResponse {
        return api.submitFeedback(spotId, FeedbackRequest(text))
    }
}
