package surf.shouldigo.app.feature.conditions.components

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import surf.shouldigo.app.data.model.BoardRecommendation
import surf.shouldigo.app.data.model.SurfConditions
import surf.shouldigo.app.domain.wetsuitRecommendation
import surf.shouldigo.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BoardCard(
    recommendation: BoardRecommendation,
    conditions: SurfConditions,
    savedWeight: String = "",
    savedSkill: String = "",
    onPersonalize: (weight: String?, skill: String?) -> Unit = { _, _ -> }
) {
    var weight by remember(savedWeight) { mutableStateOf(savedWeight) }
    var skill by remember(savedSkill) { mutableStateOf(savedSkill) }
    var expanded by remember { mutableStateOf(false) }
    var showSaved by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    val skillOptions = listOf("", "beginner", "intermediate", "advanced", "expert")

    LaunchedEffect(showSaved) {
        if (showSaved) {
            delay(2000)
            showSaved = false
        }
    }

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = CardBackground
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            SectionHeader("Suggested Gear for Today")
            Spacer(modifier = Modifier.height(14.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Board card
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Background,
                    modifier = Modifier.weight(1f)
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        BoardIllustration(
                            boardType = recommendation.boardType,
                            modifier = Modifier.size(width = 28.dp, height = 64.dp)
                        )
                        Text(
                            text = recommendation.boardName
                                ?: recommendation.boardType.replaceFirstChar { it.uppercase() },
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1
                        )
                        recommendation.reason?.let { reason ->
                            Text(
                                text = reason,
                                fontSize = 12.sp,
                                color = SecondaryText,
                                maxLines = 2,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }

                // Wetsuit card
                conditions.weather?.waterTemp?.let { wt ->
                    val (name, desc) = wetsuitRecommendation(wt)
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = Background,
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            WetsuitIllustration(
                                isShorts = wt >= 24,
                                modifier = Modifier.size(width = 36.dp, height = 64.dp)
                            )
                            Text(
                                text = name,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1
                            )
                            Text(
                                text = "${wt.toInt()}\u00B0C water",
                                fontSize = 12.sp,
                                color = SecondaryText
                            )
                        }
                    }
                }
            }

            // Personalize section
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Personalize",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = SecondaryText
                )
                AnimatedVisibility(
                    visible = showSaved,
                    enter = fadeIn() + slideInHorizontally(),
                    exit = fadeOut()
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Icon(
                            Icons.Default.Check,
                            contentDescription = null,
                            tint = Accent,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = "Updating recommendation...",
                            fontSize = 11.sp,
                            color = Accent
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = "Weight (kg)", fontSize = 10.sp, color = SecondaryText)
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = weight,
                        onValueChange = { newValue ->
                            // Only allow digits, max 3 chars
                            val filtered = newValue.filter { it.isDigit() }.take(3)
                            weight = filtered
                        },
                        placeholder = { Text("75") },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Number,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                if (weight.isNotEmpty()) {
                                    onPersonalize(weight, skill.ifEmpty { null })
                                    showSaved = true
                                }
                            }
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        textStyle = LocalTextStyle.current.copy(fontSize = 14.sp)
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(text = "Skill", fontSize = 10.sp, color = SecondaryText)
                    Spacer(modifier = Modifier.height(4.dp))
                    ExposedDropdownMenuBox(
                        expanded = expanded,
                        onExpandedChange = { expanded = !expanded }
                    ) {
                        OutlinedTextField(
                            value = if (skill.isEmpty()) "--" else skill.replaceFirstChar { it.uppercase() },
                            onValueChange = {},
                            readOnly = true,
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                            singleLine = true,
                            textStyle = LocalTextStyle.current.copy(fontSize = 14.sp)
                        )
                        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                            skillOptions.forEach { option ->
                                DropdownMenuItem(
                                    text = {
                                        Text(
                                            if (option.isEmpty()) "--"
                                            else option.replaceFirstChar { it.uppercase() }
                                        )
                                    },
                                    onClick = {
                                        skill = option
                                        expanded = false
                                        onPersonalize(weight.ifEmpty { null }, option.ifEmpty { null })
                                        showSaved = true
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
