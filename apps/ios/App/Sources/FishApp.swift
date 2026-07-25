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

@main
struct FishApp: App {
    @State private var model = FishAppModel(configuration: .fromBundle())
    @State private var deviceSettings = DeviceSettingsStore()
    @UIApplicationDelegateAdaptor(FishAppDelegate.self) private var appDelegate

    init() {
        Fonts.register()
    }

    var body: some Scene {
        WindowGroup {
            FishRoot(model: model, deviceSettings: deviceSettings)
                .onOpenURL { url in
                    model.handle(url: url)
                }
        }
    }
}
