package space.fishhub.android

import android.app.Application
import space.fishhub.android.calling.AndroidCallSystemGateway
import space.fishhub.android.core.supabase.SupabaseClientFactory
import space.fishhub.android.data.call.CallDataModule
import space.fishhub.android.data.chat.ChatRepository
import space.fishhub.android.data.chat.ChatDataModule
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.OutgoingMessageContent
import space.fishhub.android.data.chat.GifRepository
import space.fishhub.android.data.presence.PresenceDataModule
import space.fishhub.android.data.presence.PresenceRepository
import space.fishhub.android.feature.call.CallCoordinator
import space.fishhub.android.settings.AppPreferenceStore
import space.fishhub.android.messaging.ChatReplyStore
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.work.Configuration

class FishApplication : Application(), Configuration.Provider {
    private val supabaseClient by lazy {
        SupabaseClientFactory.create(
            url = BuildConfig.SUPABASE_URL,
            publishableKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY,
        )
    }

    private val chatDependencies by lazy {
        ChatDataModule.create(
            context = this,
            supabaseClient = supabaseClient,
            klipyApiKey = BuildConfig.KLIPY_API_KEY,
            klipyClientKey = BuildConfig.KLIPY_CLIENT_KEY,
            onBeforeSignOut = {
                runCatching { presenceRepository.endSession() }
                runCatching { callCoordinator.unregisterPushDevice() }
            },
        )
    }

    private val presenceDependencies by lazy {
        PresenceDataModule.create(supabaseClient)
    }

    private val callDependencies by lazy {
        CallDataModule.create(this, supabaseClient)
    }

    private val callSystemGateway by lazy {
        AndroidCallSystemGateway(this, callDependencies.scope)
    }

    val callCoordinator: CallCoordinator by lazy {
        CallCoordinator(
            repository = callDependencies.repository,
            mediaEngine = callDependencies.mediaEngine,
            deviceStore = callDependencies.deviceStore,
            systemGateway = callSystemGateway,
            scope = callDependencies.scope,
            appVersion = BuildConfig.VERSION_NAME,
        )
    }

    val callScope: CoroutineScope get() = callDependencies.scope

    val appPreferenceStore: AppPreferenceStore by lazy { AppPreferenceStore(this) }

    val chatRepository: ChatRepository get() = chatDependencies.chatRepository
    val gifRepository: GifRepository get() = chatDependencies.gifRepository
    val presenceRepository: PresenceRepository get() = presenceDependencies.repository

    suspend fun processPendingChatReplies() {
        val auth = chatRepository.authState.value
        if (auth !is ChatAuthState.SignedIn) return
        val directory = (chatRepository.listAuthorizedConversations() as? ChatResult.Success)
            ?.value
            ?: return
        val allowed = directory.conversations.mapTo(mutableSetOf()) { it.conversationId }
        ChatReplyStore.pending(this).forEach { reply ->
            if (!allowed.contains(reply.conversationId)) {
                ChatReplyStore.remove(this, reply.id)
                return@forEach
            }
            when (val result = chatRepository.sendMessage(
                conversationId = reply.conversationId,
                content = OutgoingMessageContent(body = reply.body),
                clientRequestId = reply.id,
            )) {
                is ChatResult.Success -> ChatReplyStore.remove(this, reply.id)
                is ChatResult.Failure -> if (
                    result.category == space.fishhub.android.data.chat.FailureCategory.Authentication ||
                    result.category == space.fishhub.android.data.chat.FailureCategory.Authorization
                ) ChatReplyStore.remove(this, reply.id)
            }
        }
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(chatDependencies.workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        chatDependencies.startAttachmentMaintenanceAndRecovery()
        callCoordinator
        ProcessLifecycleOwner.get().lifecycle.addObserver(
            PresenceLifecycleObserver(presenceRepository),
        )
        initializeFirebase()
        callScope.launch {
            chatRepository.authState.collectLatest { auth ->
                when (auth) {
                    is ChatAuthState.SignedIn -> processPendingChatReplies()
                    ChatAuthState.SignedOut -> ChatReplyStore.clear(this@FishApplication)
                    ChatAuthState.Loading -> Unit
                }
            }
        }
    }

    private fun initializeFirebase() {
        if (listOf(
                BuildConfig.FIREBASE_PROJECT_ID,
                BuildConfig.FIREBASE_APPLICATION_ID,
                BuildConfig.FIREBASE_API_KEY,
                BuildConfig.FIREBASE_SENDER_ID,
            ).any(String::isBlank)
        ) return
        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(
                this,
                FirebaseOptions.Builder()
                    .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
                    .setApplicationId(BuildConfig.FIREBASE_APPLICATION_ID)
                    .setApiKey(BuildConfig.FIREBASE_API_KEY)
                    .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                    .build(),
            )
        }
        FirebaseMessaging.getInstance().register()
    }
}
