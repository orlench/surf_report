package surf.shouldigo.app.feature.conditions.components

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import surf.shouldigo.app.data.model.RecentFeedback
import surf.shouldigo.app.data.repository.FeedbackRepository
import javax.inject.Inject

data class FeedbackUiState(
    val text: String = "",
    val isLoading: Boolean = false,
    val feedbackCount: Int = 0,
    val multipliers: Map<String, Double>? = null,
    val recentFeedback: List<RecentFeedback> = emptyList(),
    val showRecent: Boolean = false
)

@HiltViewModel
class SpotFeedbackViewModel @Inject constructor(
    private val feedbackRepo: FeedbackRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(FeedbackUiState())
    val uiState: StateFlow<FeedbackUiState> = _uiState

    fun updateText(text: String) {
        _uiState.update { it.copy(text = text) }
    }

    fun toggleRecent() {
        _uiState.update { it.copy(showRecent = !it.showRecent) }
    }

    fun loadFeedback(spotId: String) {
        viewModelScope.launch {
            try {
                val response = feedbackRepo.fetchFeedback(spotId)
                _uiState.update {
                    it.copy(
                        feedbackCount = response.feedbackCount,
                        recentFeedback = response.recentFeedback ?: emptyList()
                    )
                }
            } catch (_: Exception) {}
        }
    }

    fun submit(spotId: String) {
        val trimmed = _uiState.value.text.trim()
        if (trimmed.length < 10) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val response = feedbackRepo.submitFeedback(spotId, trimmed)
                _uiState.update {
                    it.copy(
                        multipliers = response.yourMultipliers ?: response.multipliers,
                        feedbackCount = response.feedbackCount ?: (it.feedbackCount + 1),
                        text = "",
                        isLoading = false
                    )
                }
                loadFeedback(spotId)
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }
}
