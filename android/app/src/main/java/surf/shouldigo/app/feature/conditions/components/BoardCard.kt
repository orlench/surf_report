package surf.shouldigo.app.feature.conditions.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import surf.shouldigo.app.data.model.BoardRecommendation
import surf.shouldigo.app.data.model.SurfConditions
import surf.shouldigo.app.domain.boardEmoji
import surf.shouldigo.app.domain.wetsuitRecommendation
import surf.shouldigo.app.ui.theme.*

@Composable
fun BoardCard(
    recommendation: BoardRecommendation,
    conditions: SurfConditions
) {
    var weight by remember { mutableStateOf("") }
    var skill by remember { mutableStateOf("") }
    var expanded by remember { mutableStateOf(false) }
    val skillOptions = listOf("", "beginner", "intermediate", "advanced", "expert")

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = CardBackground
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            SectionHeader("Gear")
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
                        Text(
                            text = boardEmoji(recommendation.boardType),
                            fontSize = 32.sp
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
                            Text(text = "\uD83C\uDFC4", fontSize = 28.sp)
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
            Text(
                text = "Personalize",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = SecondaryText
            )
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
                        onValueChange = { weight = it },
                        placeholder = { Text("75") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
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
