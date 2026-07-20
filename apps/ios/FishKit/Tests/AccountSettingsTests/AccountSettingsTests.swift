import Foundation
import Testing
@testable import AccountSettings

@MainActor
struct AccountSettingsTests {
    @Test func invalidDeviceValuesDefaultToSystem() {
        let suiteName = "fish.account-settings-tests-invalid"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        defaults.set("unexpected", forKey: "fish.account.appearance")
        defaults.set("reduced", forKey: "fish.account.motion")

        let store = DeviceSettingsStore(defaults: defaults)

        #expect(store.appearance == .system)
        #expect(store.motion == .system)
        defaults.removePersistentDomain(forName: suiteName)
    }

    @Test func deviceValuesPersistAndCombineWithSystemMotion() {
        let suiteName = "fish.account-settings-tests-persistence"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        let store = DeviceSettingsStore(defaults: defaults)

        store.setAppearance(.dark)
        store.setMotion(.reduceMotion)
        let reloaded = DeviceSettingsStore(defaults: defaults)

        #expect(reloaded.appearance == .dark)
        #expect(reloaded.motion == .reduceMotion)
        #expect(reloaded.effectiveReduceMotion(systemReduceMotion: false))
        #expect(reloaded.effectiveReduceMotion(systemReduceMotion: true))
        defaults.removePersistentDomain(forName: suiteName)
    }

    @Test(arguments: [
        AccountNotificationAuthorization.notDetermined,
        .denied,
        .authorized,
        .provisional,
        .ephemeral,
    ]) func notificationStateUsesCalmRootLabels(
        _ state: AccountNotificationAuthorization
    ) {
        #expect(state.rootLabel == ([.authorized, .provisional, .ephemeral].contains(state) ? "On" : "Off"))
        #expect(state.requiresPrompt == (state == .notDetermined))
    }

    @Test func webLinksAllowOnlyFixedSafeDestinations() {
        let base = URL(string: "https://fishhub.space")
        #expect(
            AccountSettingsWebLinkPolicy.url(
                baseURL: base,
                path: .forgotPassword,
                isRelease: true
            )?.absoluteString == "https://fishhub.space/forgot-password"
        )
        #expect(
            AccountSettingsWebLinkPolicy.url(
                baseURL: base,
                path: .privacy,
                isRelease: true
            )?.absoluteString == "https://fishhub.space/privacy"
        )
        #expect(
            AccountSettingsWebLinkPolicy.url(
                baseURL: URL(string: "http://localhost:54321"),
                path: .privacy,
                isRelease: false
            )?.absoluteString == "http://localhost:54321/privacy"
        )
    }

    @Test func webLinksFailClosedForUnsafeConfiguration() {
        let invalid = [
            URL(string: "http://fishhub.space"),
            URL(string: "https://user:password@fishhub.space"),
            URL(string: "https://:password@fishhub.space"),
            URL(string: "https://fishhub.space/base"),
            URL(string: "https://fishhub.space?next=https://evil.example"),
            URL(string: "https://fishhub.space/#fragment"),
            URL(string: "javascript:alert(1)"),
        ]
        for base in invalid {
            #expect(
                AccountSettingsWebLinkPolicy.url(
                    baseURL: base,
                    path: .privacy,
                    isRelease: true
                ) == nil
            )
        }
    }

    @Test func blockedStateRetainsIdentityAndBusyIds() {
        let person = AccountSettingsBlockedPerson(
            userId: "person-1",
            displayName: "Maya",
            username: "maya"
        )
        let state = AccountSettingsBlockedPeopleState.loaded(
            people: [person],
            busyIds: [person.userId]
        )

        guard case .loaded(let people, let busyIds, let notice) = state else {
            Issue.record("Expected loaded blocked people")
            return
        }
        #expect(people == [person])
        #expect(busyIds == ["person-1"])
        #expect(notice == nil)
    }
}
