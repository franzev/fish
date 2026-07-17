// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "FishKit",
    defaultLocalization: "en",
    // macOS is never shipped; it only satisfies host-side tooling (SPM builds
    // of the Foundation-only targets and dependency minimums like LiveKit's).
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "DesignSystem", targets: ["DesignSystem"]),
        .library(name: "UIComponents", targets: ["UIComponents"]),
        .library(name: "ChatData", targets: ["ChatData"]),
        .library(name: "PersonalChat", targets: ["PersonalChat"]),
        .library(name: "CallData", targets: ["CallData"]),
        .library(name: "Calls", targets: ["Calls"]),
        .library(name: "CallMediaLiveKit", targets: ["CallMediaLiveKit"]),
        .library(name: "PresenceData", targets: ["PresenceData"]),
        .library(name: "Presence", targets: ["Presence"]),
        .library(name: "TestSupport", targets: ["TestSupport"]),
    ],
    dependencies: [
        .package(
            url: "https://github.com/pointfreeco/swift-snapshot-testing",
            from: "1.17.0"
        ),
        .package(
            url: "https://github.com/livekit/client-sdk-swift",
            from: "2.0.0"
        ),
        .package(
            url: "https://github.com/supabase/supabase-swift",
            from: "2.52.0"
        ),
    ],
    targets: [
        .target(
            name: "DesignSystem",
            resources: [.process("Resources")]
        ),
        .target(name: "UIComponents", dependencies: ["DesignSystem"]),
        .target(name: "ChatData"),
        .target(
            name: "PersonalChat",
            dependencies: ["DesignSystem", "UIComponents", "ChatData"],
            resources: [.copy("Resources/ChatMedia")]
        ),
        .target(name: "CallData"),
        .target(
            name: "Calls",
            dependencies: ["DesignSystem", "UIComponents", "CallData"]
        ),
        .target(
            name: "PresenceData",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift")
            ]
        ),
        .target(
            name: "Presence",
            dependencies: ["DesignSystem", "UIComponents", "PresenceData"]
        ),
        .target(
            name: "CallMediaLiveKit",
            dependencies: [
                "Calls",
                .product(name: "LiveKit", package: "client-sdk-swift"),
            ]
        ),
        .target(
            name: "TestSupport",
            dependencies: [
                "DesignSystem", "UIComponents", "ChatData", "PersonalChat",
                "CallData", "Calls", "PresenceData",
            ],
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "ChatDataTests",
            dependencies: ["ChatData"]
        ),
        .testTarget(
            name: "CallDataTests",
            dependencies: ["CallData", "TestSupport"]
        ),
        .testTarget(
            name: "PresenceDataTests",
            dependencies: ["PresenceData", "TestSupport"]
        ),
        .testTarget(
            name: "PresenceTests",
            dependencies: [
                "Presence",
                "TestSupport",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
            ]
        ),
        .testTarget(
            name: "CallsTests",
            dependencies: [
                "Calls",
                "TestSupport",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
            ]
        ),
        .testTarget(
            name: "DesignSystemTests",
            dependencies: [
                "DesignSystem",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
            ]
        ),
        .testTarget(
            name: "UIComponentsTests",
            dependencies: [
                "UIComponents",
                "TestSupport",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
            ]
        ),
        .testTarget(
            name: "PersonalChatTests",
            dependencies: [
                "PersonalChat",
                "TestSupport",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
            ]
        ),
    ],
    swiftLanguageModes: [.v6]
)
