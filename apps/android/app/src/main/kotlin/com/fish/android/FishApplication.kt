package com.fish.android

import android.app.Application
import com.fish.android.data.chat.ChatRepository
import com.fish.android.data.chat.ChatDataModule

class FishApplication : Application() {
    val chatRepository: ChatRepository by lazy {
        ChatDataModule.create(
            context = this,
            supabaseUrl = BuildConfig.SUPABASE_URL,
            publishableKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY,
        )
    }
}
