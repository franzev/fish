package space.fishhub.android.feature.friends

import android.content.res.Configuration
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.android.tools.screenshot.PreviewTest
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.friends.views.FriendsPreviewContent

@PreviewTest
@Preview(name = "add friend input light", widthDp = 412, heightDp = 640, showBackground = true)
@Composable
fun AddFriendInputLightScreenshot() = FriendsFrame("input", false)

@PreviewTest
@Preview(
    name = "add friend input dark",
    widthDp = 412,
    heightDp = 640,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
    showBackground = true,
)
@Composable
fun AddFriendInputDarkScreenshot() = FriendsFrame("input", true)

@PreviewTest
@Preview(name = "add friend input compact", widthDp = 320, heightDp = 640, showBackground = true)
@Composable
fun AddFriendInputCompactScreenshot() = FriendsFrame("input", false)

@PreviewTest
@Preview(name = "add friend input large font", widthDp = 412, heightDp = 915, fontScale = 2f)
@Composable
fun AddFriendInputLargeFontScreenshot() = FriendsFrame("input", false)

@PreviewTest
@Preview(name = "add friend candidate", widthDp = 412, heightDp = 640, showBackground = true)
@Composable
fun AddFriendCandidateScreenshot() = FriendsFrame("candidate", false)

@PreviewTest
@Preview(
    name = "add friend candidate dark",
    widthDp = 412,
    heightDp = 640,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
    showBackground = true,
)
@Composable
fun AddFriendCandidateDarkScreenshot() = FriendsFrame("candidate", true)

@PreviewTest
@Preview(name = "add friend sent", widthDp = 412, heightDp = 640, showBackground = true)
@Composable
fun AddFriendSentScreenshot() = FriendsFrame("sent", false)

@PreviewTest
@Preview(name = "add friend already friends", widthDp = 412, heightDp = 640, showBackground = true)
@Composable
fun AddFriendAlreadyFriendsScreenshot() = FriendsFrame("friends", false)

@PreviewTest
@Preview(name = "add friend incoming rtl", widthDp = 412, heightDp = 640, locale = "ar")
@Composable
fun AddFriendIncomingRtlScreenshot() = FriendsFrame("incoming", false)

@PreviewTest
@Preview(name = "add friend incoming large font", widthDp = 412, heightDp = 915, fontScale = 2f)
@Composable
fun AddFriendIncomingLargeFontScreenshot() = FriendsFrame("incoming", false)

@PreviewTest
@Preview(name = "add friend unavailable", widthDp = 412, heightDp = 640, showBackground = true)
@Composable
fun AddFriendUnavailableScreenshot() = FriendsFrame("unavailable", false)

@PreviewTest
@Preview(name = "friend requests light", widthDp = 412, heightDp = 640, showBackground = true)
@Composable
fun FriendRequestsLightScreenshot() = FriendsFrame("requests", false)

@PreviewTest
@Preview(
    name = "friend requests dark",
    widthDp = 412,
    heightDp = 640,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
    showBackground = true,
)
@Composable
fun FriendRequestsDarkScreenshot() = FriendsFrame("requests", true)

@PreviewTest
@Preview(name = "friend requests compact", widthDp = 320, heightDp = 640, showBackground = true)
@Composable
fun FriendRequestsCompactScreenshot() = FriendsFrame("requests", false)

@PreviewTest
@Preview(name = "friend requests rtl", widthDp = 412, heightDp = 640, locale = "ar")
@Composable
fun FriendRequestsRtlScreenshot() = FriendsFrame("requests", false)

@PreviewTest
@Preview(name = "friend request review", widthDp = 412, heightDp = 640, showBackground = true)
@Composable
fun FriendRequestReviewScreenshot() = FriendsFrame("review", false)

@PreviewTest
@Preview(
    name = "friend request review dark",
    widthDp = 412,
    heightDp = 640,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
    showBackground = true,
)
@Composable
fun FriendRequestReviewDarkScreenshot() = FriendsFrame("review", true)

@PreviewTest
@Preview(name = "friend request review large font", widthDp = 412, heightDp = 915, fontScale = 2f)
@Composable
fun FriendRequestReviewLargeFontScreenshot() = FriendsFrame("review", false)

@PreviewTest
@Preview(name = "friend requests loading", widthDp = 412, heightDp = 640, showBackground = true)
@Composable
fun FriendRequestsLoadingScreenshot() = FriendsFrame("requests-loading", false)

@PreviewTest
@Preview(name = "friend requests empty", widthDp = 412, heightDp = 640, showBackground = true)
@Composable
fun FriendRequestsEmptyScreenshot() = FriendsFrame("requests-empty", false)

@PreviewTest
@Preview(name = "friend requests failed", widthDp = 412, heightDp = 640, showBackground = true)
@Composable
fun FriendRequestsFailedScreenshot() = FriendsFrame("requests-failed", false)

@Composable
private fun FriendsFrame(page: String, darkTheme: Boolean) {
    FishTheme(darkTheme = darkTheme, reducedMotion = true) {
        FriendsPreviewContent(page = page)
    }
}
