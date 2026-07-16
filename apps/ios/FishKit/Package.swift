// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "FishKit",
    defaultLocalization: "en",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "DesignSystem", targets: ["DesignSystem"]),
        .library(name: "UIComponents", targets: ["UIComponents"]),
        .library(name: "PersonalChat", targets: ["PersonalChat"]),
        .library(name: "TestSupport", targets: ["TestSupport"]),
    ],
    dependencies: [
        .package(
            url: "https://github.com/pointfreeco/swift-snapshot-testing",
            from: "1.17.0"
        ),
    ],
    targets: [
        .target(
            name: "DesignSystem",
            resources: [.process("Resources")]
        ),
        .target(name: "UIComponents", dependencies: ["DesignSystem"]),
        .target(
            name: "PersonalChat",
            dependencies: ["DesignSystem", "UIComponents"]
        ),
        .target(
            name: "TestSupport",
            dependencies: ["DesignSystem", "UIComponents", "PersonalChat"]
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
