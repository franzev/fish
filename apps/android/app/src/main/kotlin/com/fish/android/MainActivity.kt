package com.fish.android

import android.os.Bundle
import android.animation.ValueAnimator
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.remember
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.fish.android.core.designsystem.FishTheme
import com.fish.android.feature.chat.AndroidChatFormatter
import com.fish.android.feature.chat.ChatRoute
import com.fish.android.feature.chat.ChatViewModel
import com.fish.android.feature.chat.ChatMediaCatalog
import com.fish.android.feature.chat.MediaPickerViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val repository = (application as FishApplication).chatRepository
            val gifRepository = (application as FishApplication).gifRepository
            val formatter = remember { AndroidChatFormatter(applicationContext) }
            val mediaCatalog = remember { ChatMediaCatalog.load(applicationContext) }
            val animationsEnabled = remember { ValueAnimator.areAnimatorsEnabled() }
            val factory = remember(repository, gifRepository, formatter, mediaCatalog) {
                viewModelFactory {
                    initializer {
                        ChatViewModel(
                            repository = repository,
                            savedStateHandle = createSavedStateHandle(),
                            formatter = formatter,
                            gifRepository = gifRepository,
                            mediaCatalog = mediaCatalog,
                        )
                    }
                }
            }
            val mediaPickerFactory = remember(gifRepository, mediaCatalog, animationsEnabled) {
                viewModelFactory {
                    initializer {
                        MediaPickerViewModel(
                            catalog = mediaCatalog,
                            gifRepository = gifRepository,
                            animationsEnabled = animationsEnabled,
                        )
                    }
                }
            }
            val chatViewModel: ChatViewModel = viewModel(factory = factory)
            val mediaPickerViewModel: MediaPickerViewModel = viewModel(factory = mediaPickerFactory)
            FishTheme(reducedMotion = !animationsEnabled) {
                ChatRoute(
                    viewModel = chatViewModel,
                    mediaPickerViewModel = mediaPickerViewModel,
                    mediaCatalog = mediaCatalog,
                )
            }
        }
    }
}
