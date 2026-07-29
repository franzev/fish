import PersonalChat
import XCTest
@testable import Fish

final class FishAppConfigurationTests: XCTestCase {
    func testDevelopmentConfigurationAcceptsExactLocalHTTPForBothMediaPaths() {
        let configuration = makeConfiguration(
            url: URL(string: "http://127.0.0.1:54321"),
            isRelease: false
        )

        XCTAssertEqual(
            configuration.supabaseUrl,
            URL(string: "http://127.0.0.1:54321")
        )
        XCTAssertTrue(configuration.allowsLocalDevelopmentMedia)
        let policy = SharedContentMediaURLPolicy(
            supabaseURL: configuration.supabaseUrl,
            allowsLocalDevelopment: configuration.allowsLocalDevelopmentMedia
        )
        XCTAssertTrue(policy.allows(
            URL(string: "http://127.0.0.1:54321/storage/v1/object")!,
            kind: .storage
        ))
    }

    func testReleaseConfigurationRejectsPlaintextBackendAndMediaException() {
        let configuration = makeConfiguration(
            url: URL(string: "http://127.0.0.1:54321"),
            isRelease: true
        )

        XCTAssertNil(configuration.supabaseUrl)
        XCTAssertFalse(configuration.allowsLocalDevelopmentMedia)
    }

    func testReleaseConfigurationKeepsHTTPSBackend() {
        let configuration = makeConfiguration(
            url: URL(string: "https://project.supabase.co"),
            isRelease: true
        )

        XCTAssertEqual(
            configuration.supabaseUrl,
            URL(string: "https://project.supabase.co")
        )
        XCTAssertFalse(configuration.allowsLocalDevelopmentMedia)
    }

    func testFriendsFlagIsOnOnlyForTheExactTrueString() throws {
        XCTAssertTrue(try flag(["FRIENDS_ENABLED": "true"]))
        // Xcode passes the whole build setting through untouched, whitespace
        // and all.
        XCTAssertTrue(try flag(["FRIENDS_ENABLED": "  true  "]))
        XCTAssertFalse(try flag(["FRIENDS_ENABLED": "TRUE"]))
        XCTAssertFalse(try flag(["FRIENDS_ENABLED": "1"]))
        XCTAssertFalse(try flag(["FRIENDS_ENABLED": "yes"]))
        XCTAssertFalse(try flag(["FRIENDS_ENABLED": "false"]))
        XCTAssertFalse(try flag(["FRIENDS_ENABLED": ""]))
    }

    /// A build that never set the setting, and one whose setting resolved to
    /// nothing, both ship without friends.
    func testFriendsFlagIsOffWhenAbsentOrUnsubstituted() throws {
        XCTAssertFalse(try flag([:]))
        XCTAssertFalse(try flag(["FRIENDS_ENABLED": "$(FRIENDS_ENABLED)"]))
        XCTAssertFalse(try flag(["FRIENDS_ENABLED": "${FISH_FRIENDS_ENABLED}"]))
    }

    private func flag(_ info: [String: String]) throws -> Bool {
        try FishAppConfiguration.fromBundle(
            makeBundle(info),
            isRelease: false
        ).friendsEnabled
    }

    /// The real `fromBundle` path, Info.plist and all, rather than a stand-in
    /// for the lookup it performs.
    private func makeBundle(_ info: [String: String]) throws -> Bundle {
        let root = FileManager.default.temporaryDirectory
            .appending(path: "\(UUID().uuidString).bundle")
        try FileManager.default.createDirectory(
            at: root,
            withIntermediateDirectories: true
        )
        addTeardownBlock { try? FileManager.default.removeItem(at: root) }
        try PropertyListSerialization
            .data(fromPropertyList: info, format: .xml, options: 0)
            .write(to: root.appending(path: "Info.plist"))
        return try XCTUnwrap(Bundle(url: root))
    }

    private func makeConfiguration(
        url: URL?,
        isRelease: Bool
    ) -> FishAppConfiguration {
        FishAppConfiguration(
            supabaseUrl: url,
            anonKey: "anon",
            klipyApiKey: nil,
            klipyClientKey: "fish_chat_ios",
            webBaseURL: nil,
            friendsEnabled: false,
            isRelease: isRelease
        )
    }
}
