package surf.shouldigo.app.data.remote

import retrofit2.http.*
import surf.shouldigo.app.data.model.*

interface ApiService {

    @GET("spots")
    suspend fun fetchSpots(): SpotListResponse

    @GET("nearest-spot")
    suspend fun fetchNearestSpot(): NearestSpotResponse

    @GET("conditions/{spotId}")
    suspend fun fetchConditions(
        @Path("spotId") spotId: String,
        @Query("weight") weight: String? = null,
        @Query("skill") skill: String? = null
    ): ConditionsResponse

    @GET("conditions/custom")
    suspend fun fetchCustomConditions(
        @Query("lat") lat: Double,
        @Query("lon") lon: Double,
        @Query("name") name: String,
        @Query("country") country: String? = null
    ): ConditionsResponse

    @POST("push/subscribe")
    suspend fun subscribePush(@Body body: PushSubscribeRequest): PushSubscribeResponse

    @POST("push/unsubscribe")
    suspend fun unsubscribePush(@Body body: PushUnsubscribeRequest): GenericResponse

    @GET("spots/{spotId}/feedback")
    suspend fun fetchFeedback(@Path("spotId") spotId: String): FeedbackListResponse

    @POST("spots/{spotId}/feedback")
    suspend fun submitFeedback(
        @Path("spotId") spotId: String,
        @Body body: FeedbackRequest
    ): FeedbackResponse

    @POST("spots")
    suspend fun createSpot(@Body body: CreateSpotRequest): GenericResponse
}
