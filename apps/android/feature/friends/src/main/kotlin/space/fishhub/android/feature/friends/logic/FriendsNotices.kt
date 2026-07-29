package space.fishhub.android.feature.friends.logic

import android.content.Context
import space.fishhub.android.feature.friends.R

/**
 * The few notices friends authors itself. Everything else the ViewModel puts
 * in front of someone is the server's own calm copy, passed through verbatim.
 * Mirrors the `ChatTextFormatter` split so the ViewModel never holds a Context.
 */
interface FriendsNotices {
    /** Submitted with nothing typed. */
    val emptyUsername: String

    /** The lookup never reached the server. */
    val searchFailed: String

    /** They asked first, and the follow-up lookup could not recover the request. */
    val incomingRequestExists: String

    /** The request list never arrived. */
    val requestsLoadFailed: String
}

class AndroidFriendsNotices(context: Context) : FriendsNotices {
    private val applicationContext = context.applicationContext

    override val emptyUsername: String
        get() = applicationContext.getString(R.string.add_friend_empty_input)

    override val searchFailed: String
        get() = applicationContext.getString(R.string.add_friend_search_failed)

    override val incomingRequestExists: String
        get() = applicationContext.getString(R.string.add_friend_incoming)

    override val requestsLoadFailed: String
        get() = applicationContext.getString(R.string.friend_requests_load_failed)
}
