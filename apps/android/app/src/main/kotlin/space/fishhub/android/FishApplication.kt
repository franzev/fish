package space.fishhub.android

import android.app.Application
import space.fishhub.android.calling.AndroidCallSystemGateway
import space.fishhub.android.core.supabase.SupabaseClientFactory
import space.fishhub.android.data.call.CallDataModule
import space.fishhub.android.data.chat.ChatRepository
import space.fishhub.android.data.chat.ChatDataModule
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.GifRepository
import space.fishhub.android.data.friends.FriendsDataModule
import space.fishhub.android.data.friends.FriendsRepository
import space.fishhub.android.data.presence.PresenceDataModule
import space.fishhub.android.data.presence.PresenceRepository
import space.fishhub.android.feature.call.CallCoordinator
import space.fishhub.android.settings.AppPreferenceStore
import space.fishhub.android.messaging.ChatReplyDrainWorker
import space.fishhub.android.messaging.ChatReplyStore
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.work.Configuration
import java.util.concurrent.atomic.AtomicReference
import space.fishhub.android.data.chat.sharedcontent.SharedContentEphemeralPurgeHook
import space.fishhub.android.feature.chat.sharedcontent.SharedContentStore

class FishApplication : Application(), Configuration.Provider {
    private val activeSharedContentStore = AtomicReference<SharedContentStore?>(null)
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
            supabaseUrl = BuildConfig.SUPABASE_URL,
            allowLocalDevelopmentMedia = BuildConfig.DEBUG,
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

    private val friendsDependencies by lazy {
        FriendsDataModule.create(supabaseClient)
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
    val sharedContentGalleryRuntime: ChatDataModule.SharedContentGalleryRuntime
        get() = chatDependencies.sharedContentGalleryRuntime
    val presenceRepository: PresenceRepository get() = presenceDependencies.repository
    val friendsRepository: FriendsRepository get() = friendsDependencies.repository

    fun replaceActiveSharedContentStore(next: SharedContentStore?) {
        val previous = activeSharedContentStore.getAndSet(next)
        if (previous !== next) previous?.close()
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(chatDependencies.workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        chatRepository.registerSharedContentEphemeralPurgeHook(
            SharedContentEphemeralPurgeHook { _, _ ->
                replaceActiveSharedContentStore(null)
                true
            },
        )
        chatDependencies.startAttachmentMaintenanceAndRecovery()
        callCoordinator
        ProcessLifecycleOwner.get().lifecycle.addObserver(
            PresenceLifecycleObserver(presenceRepository),
        )
        initializeFirebase()
        callScope.launch {
            chatRepository.authState.collectLatest { auth ->
                when (auth) {
                    is ChatAuthState.SignedIn ->
                        ChatReplyDrainWorker.enqueue(this@FishApplication)
                    ChatAuthState.SignedOut -> {
                        ChatReplyStore.clear(this@FishApplication)
                        ChatReplyDrainWorker.cancel(this@FishApplication)
                    }
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
