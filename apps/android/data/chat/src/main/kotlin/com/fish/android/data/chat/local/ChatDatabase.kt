package com.fish.android.data.chat.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        ConversationEntity::class,
        MessageEntity::class,
        ReadStateEntity::class,
        DraftEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class ChatDatabase : RoomDatabase() {
    abstract fun chatDao(): ChatDao
}
