import Foundation
import Testing
@testable import DesignSystem

private func relativeLuminance(_ color: ColorComponents) -> Double {
    func linear(_ value: Double) -> Double {
        value <= 0.04045
            ? value / 12.92
            : pow((value + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * linear(color.red)
        + 0.7152 * linear(color.green)
        + 0.0722 * linear(color.blue)
}

private func contrast(_ first: ColorComponents, _ second: ColorComponents) -> Double {
    let firstLuminance = relativeLuminance(first)
    let secondLuminance = relativeLuminance(second)
    let high = max(firstLuminance, secondLuminance)
    let low = min(firstLuminance, secondLuminance)
    return (high + 0.05) / (low + 0.05)
}

struct ContrastTests {
    private let textRoles: [(String, ColorPair)] = [
        ("foreground", ColorTokens.foreground),
        ("body", ColorTokens.body),
        ("muted", ColorTokens.muted),
        ("notice", ColorTokens.notice),
        ("error", ColorTokens.error),
        ("warning", ColorTokens.warning),
        ("success", ColorTokens.success),
    ]

    private let canvases: [(String, ColorPair)] = [
        ("bg", ColorTokens.bg),
        ("surface", ColorTokens.surface),
        ("surface2", ColorTokens.surface2),
    ]

    @Test func textRolesMeetAAOnEveryCanvasInBothThemes() {
        for (textName, text) in textRoles {
            for (canvasName, canvas) in canvases {
                #expect(
                    contrast(text.light, canvas.light) >= 4.5,
                    "\(textName) on \(canvasName), light"
                )
                #expect(
                    contrast(text.dark, canvas.dark) >= 4.5,
                    "\(textName) on \(canvasName), dark"
                )
            }
        }
    }

    @Test func messageColorsMeetAA() {
        #expect(contrast(ColorTokens.onPrimary.light, ColorTokens.primary.light) >= 4.5)
        #expect(contrast(ColorTokens.onPrimary.dark, ColorTokens.primary.dark) >= 4.5)
        #expect(contrast(
            ColorTokens.onMessageIncoming.light,
            ColorTokens.messageIncomingContainer.light
        ) >= 4.5)
        #expect(contrast(
            ColorTokens.onMessageIncoming.dark,
            ColorTokens.messageIncomingContainer.dark
        ) >= 4.5)
    }

    @Test func boundariesAndPresenceMeetThreeToOne() {
        for pair in [ColorTokens.border, ColorTokens.borderStrong] {
            #expect(contrast(pair.light, ColorTokens.bg.light) >= 3)
            #expect(contrast(pair.dark, ColorTokens.bg.dark) >= 3)
        }
        for pair in [
            ColorTokens.presenceOnline,
            ColorTokens.presenceIdle,
            ColorTokens.presenceAway,
            ColorTokens.presenceBusy,
            ColorTokens.presenceOffline,
        ] {
            #expect(contrast(pair.light, ColorTokens.surface.light) >= 3)
            #expect(contrast(pair.dark, ColorTokens.surface.dark) >= 3)
        }
    }

    @Test func chatAliasesResolveToAcceptedRoles() {
        #expect(ColorTokens.messageOutgoingContainer == ColorTokens.primary)
        #expect(ColorTokens.onMessageOutgoing == ColorTokens.onPrimary)
        #expect(ColorTokens.messageIncomingContainer == ColorTokens.surface)
        #expect(ColorTokens.onMessageIncoming == ColorTokens.body)
        #expect(ColorTokens.messageFailed == ColorTokens.error)
    }
}
