package com.fish.android.data.chat

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import java.util.UUID

private val Context.gifProviderPreferences by preferencesDataStore(name = "gif-provider")

internal fun interface GifCustomerIdStore {
    suspend fun getOrCreate(): String
}

internal class DataStoreGifCustomerIdStore(context: Context) : GifCustomerIdStore {
    private val dataStore = context.applicationContext.gifProviderPreferences

    override suspend fun getOrCreate(): String {
        val updated = dataStore.edit { preferences ->
            if (preferences[CustomerIdKey].isNullOrBlank()) {
                preferences[CustomerIdKey] = UUID.randomUUID().toString()
            }
        }
        return checkNotNull(updated[CustomerIdKey])
    }

    private companion object {
        val CustomerIdKey = stringPreferencesKey("customer_id")
    }
}
