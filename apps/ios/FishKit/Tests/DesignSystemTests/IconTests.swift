import Testing
@testable import DesignSystem

struct IconTests {
    @MainActor @Test func everyIconResolvesFromTheBundle() {
        for icon in Icon.allCases {
            #expect(icon.uiImage != nil, "\(icon.rawValue) missing from Icons.xcassets")
        }
    }

    @Test func navigationArrowsAreDirectional() {
        #expect(Icon.allCases.filter(\.isDirectional) == [.back, .chevronLeft, .chevronRight])
    }
}
