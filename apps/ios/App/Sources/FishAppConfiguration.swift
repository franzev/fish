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

struct FishAppConfiguration: Sendable {
    let supabaseUrl: URL?
    let anonKey: String?
    let klipyApiKey: String?
    let klipyClientKey: String
    let webBaseURL: URL?
    /// Adding a friend by username and reviewing requests. Off unless the
    /// build says otherwise, mirroring the server's own fail-closed gate.
    let friendsEnabled: Bool
    let isRelease: Bool

    init(
        supabaseUrl: URL?,
        anonKey: String?,
        klipyApiKey: String?,
        klipyClientKey: String,
        webBaseURL: URL?,
        friendsEnabled: Bool,
        isRelease: Bool
    ) {
        self.supabaseUrl = Self.validatedBackendURL(
            supabaseUrl,
            isRelease: isRelease
        )
        self.anonKey = anonKey
        self.klipyApiKey = klipyApiKey
        self.klipyClientKey = klipyClientKey
        self.webBaseURL = webBaseURL
        self.friendsEnabled = friendsEnabled
        self.isRelease = isRelease
    }

    var allowsLocalDevelopmentMedia: Bool {
        !isRelease &&
            SharedContentMediaURLPolicy.isLocalDevelopmentBackend(supabaseUrl)
    }

    static func fromBundle(
        _ bundle: Bundle = .main,
        isRelease: Bool = {
            #if DEBUG
            false
            #else
            true
            #endif
        }()
    ) -> FishAppConfiguration {
        func value(_ key: String) -> String? {
            let raw = bundle.object(forInfoDictionaryKey: key) as? String
            let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return trimmed.isEmpty || trimmed.hasPrefix("$(") || trimmed.hasPrefix("${")
                ? nil
                : trimmed
        }
        return FishAppConfiguration(
            supabaseUrl: value("SUPABASE_URL").flatMap(URL.init(string:)),
            anonKey: value("SUPABASE_ANON_KEY"),
            klipyApiKey: value("KLIPY_API_KEY"),
            klipyClientKey: value("KLIPY_CLIENT_KEY") ?? "fish_chat_ios",
            webBaseURL: value("WEB_BASE_URL").flatMap(URL.init(string:)),
            // Exactly "true" turns friends on. An unset build setting, a
            // placeholder, and anything else all mean off, so a build that
            // never heard of this flag ships without friends.
            friendsEnabled: value("FRIENDS_ENABLED") == "true",
            isRelease: isRelease
        )
    }

    func webURL(_ path: AccountSettingsWebPath) -> URL? {
        AccountSettingsWebLinkPolicy.url(
            baseURL: webBaseURL,
            path: path,
            isRelease: isRelease
        )
    }

    private static func validatedBackendURL(
        _ url: URL?,
        isRelease: Bool
    ) -> URL? {
        guard let url else { return nil }
        if isRelease {
            return url.scheme?.lowercased() == "https" ? url : nil
        }
        return url.scheme?.lowercased() == "https" ||
            SharedContentMediaURLPolicy.isLocalDevelopmentBackend(url)
            ? url
            : nil
    }
}
