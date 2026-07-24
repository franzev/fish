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
            isRelease: isRelease
        )
    }
}
