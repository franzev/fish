package com.fish.android

import android.app.Application
import com.fish.android.data.chat.ChatRepository
import com.fish.android.data.chat.ChatDataModule
import com.fish.android.data.chat.GifRepository

class FishApplication : Application() {
    private val chatDependencies by lazy {
        ChatDataModule.create(
            context = this,
            supabaseUrl = BuildConfig.SUPABASE_URL,
            publishableKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY,
            klipyApiKey = BuildConfig.KLIPY_API_KEY,
            klipyClientKey = BuildConfig.KLIPY_CLIENT_KEY,
        )
    }

    val chatRepository: ChatRepository get() = chatDependencies.chatRepository
    val gifRepository: GifRepository get() = chatDependencies.gifRepository
}
