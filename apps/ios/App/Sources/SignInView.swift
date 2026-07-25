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

struct SignInView: View {
    @Bindable var model: FishAppModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                Spacer(minLength: Spacing.twoXl)
                Text("Messages")
                    .textStyle(.display)
                    .foregroundStyle(Palette.foreground)
                Text("Sign in to continue your conversations.")
                    .textStyle(.body)
                    .foregroundStyle(Palette.body)
                InputField(label: "Email", text: $model.email)
                InputField(
                    label: "Password",
                    text: $model.password,
                    isSecure: true
                )
                ActionButton("Forgot password", variant: .link, fullWidth: true) {
                    model.openWebPage(.forgotPassword)
                }
                if let notice = model.notice {
                    Notice(title: notice, tone: .notice)
                }
                ActionButton(
                    "Sign in",
                    variant: .primary,
                    isLoading: model.isSubmitting,
                    fullWidth: true
                ) {
                    Task { await model.signIn() }
                }
                Spacer(minLength: Spacing.twoXl)
            }
            .padding(Spacing.page)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .background(Palette.bg)
    }
}
