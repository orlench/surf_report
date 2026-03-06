package surf.shouldigo.app.feature.notifications

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import surf.shouldigo.app.data.local.SecureStorage
import surf.shouldigo.app.data.repository.PushRepository
import javax.inject.Inject

data class PushUiState(
    val isSubscribed: Boolean = false,
    val threshold: Int = 65,
    val isLoading: Boolean = false,
    val hasPermission: Boolean = true,
    val subscriptionCount: Int = 0,
    val error: String? = null
)

@HiltViewModel
class PushViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val pushRepo: PushRepository,
    private val secureStorage: SecureStorage
) : ViewModel() {

    private val _uiState = MutableStateFlow(PushUiState())
    val uiState: StateFlow<PushUiState> = _uiState

    fun loadState(spotId: String) {
        val isSubscribed = pushRepo.isSubscribed(spotId)
        val subscription = pushRepo.getSubscription(spotId)
        val hasPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
        } else true

        _uiState.value = PushUiState(
            isSubscribed = isSubscribed,
            threshold = subscription?.threshold ?: 65,
            hasPermission = hasPermission,
            subscriptionCount = pushRepo.subscriptionCount()
        )
    }

    fun setThreshold(threshold: Int) {
        _uiState.update { it.copy(threshold = threshold) }
    }

    fun subscribe(spotId: String, spotName: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                ensureToken()
                val success = pushRepo.subscribe(spotId, spotName, _uiState.value.threshold)
                _uiState.update {
                    it.copy(
                        isSubscribed = success,
                        isLoading = false,
                        subscriptionCount = pushRepo.subscriptionCount(),
                        error = if (!success) "Failed to subscribe" else null
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun unsubscribe(spotId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val success = pushRepo.unsubscribe(spotId)
                _uiState.update {
                    it.copy(
                        isSubscribed = !success,
                        isLoading = false,
                        subscriptionCount = pushRepo.subscriptionCount()
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    private suspend fun ensureToken() {
        if (secureStorage.getToken() == null) {
            val token = FirebaseMessaging.getInstance().token.await()
            secureStorage.saveToken(token)
        }
    }
}
