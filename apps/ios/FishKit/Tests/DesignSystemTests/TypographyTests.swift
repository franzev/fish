import Testing
import UIKit
@testable import DesignSystem

struct TypographyTests {
    @MainActor @Test func bundledNamedInstancesResolve() {
        Fonts.register()
        let required = [
            "Lexend-Regular",
            "Lexend-Medium",
            "Fraunces-SemiBold",
        ]
        for name in required where UIFont(name: name, size: 17) == nil {
            let families = UIFont.familyNames.filter {
                $0.contains("Lexend") || $0.contains("Fraunces")
            }
            let available = families.flatMap(UIFont.fontNames(forFamilyName:))
            Issue.record("Missing \(name). Registered FISH font names: \(available)")
        }
        #expect(UIFont(name: "Lexend-Regular", size: 17) != nil)
        #expect(UIFont(name: "Lexend-Medium", size: 14) != nil)
        #expect(UIFont(name: "Fraunces-SemiBold", size: 20) != nil)
    }

    @Test func ladderMatchesProductSpec() {
        #expect(TypeScale.body.size == 17)
        #expect(TypeScale.body.lineHeight == 1.55)
        #expect(TypeScale.heading.size == 20)
        #expect(TypeScale.caption.size == 13)
        #expect(Typography.extraLineSpacing(for: .heading) == 0)
        #expect(Typography.extraLineSpacing(for: .body) > 0)
    }
}
