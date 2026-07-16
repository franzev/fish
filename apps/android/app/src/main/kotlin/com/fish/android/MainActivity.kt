package com.fish.android

import android.os.Bundle
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

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val repository = (application as FishApplication).chatRepository
            val formatter = remember { AndroidChatFormatter(applicationContext) }
            val factory = remember(repository, formatter) {
                viewModelFactory {
                    initializer {
                        ChatViewModel(repository, createSavedStateHandle(), formatter)
                    }
                }
            }
            val chatViewModel: ChatViewModel = viewModel(factory = factory)
            FishTheme {
                ChatRoute(viewModel = chatViewModel)
            }
        }
    }
}
