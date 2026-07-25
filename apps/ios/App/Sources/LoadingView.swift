import AccountSettings
import CallData
import CallMediaLiveKit
import Calls
import ChatCore
import ChatData
import DesignSystem
import Foundation
import Observation
import PersonalChat
import QuickLook
import SwiftUI
import UIKit
import UIComponents
import UserNotifications

struct LoadingView: View {
    var message = "Loading messages…"

    var body: some View {
        VStack(spacing: Spacing.md) {
            ProgressView()
            Text(message)
                .textStyle(.body)
                .foregroundStyle(Palette.body)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.bg)
    }
}
