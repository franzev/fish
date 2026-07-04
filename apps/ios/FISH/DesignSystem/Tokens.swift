import SwiftUI
import UIKit

private extension UIColor {
    convenience init(hex: UInt32) {
        let red = CGFloat((hex >> 16) & 0xff) / 255
        let green = CGFloat((hex >> 8) & 0xff) / 255
        let blue = CGFloat(hex & 0xff) / 255
        self.init(red: red, green: green, blue: blue, alpha: 1)
    }
}

private extension Color {
    static func fishToken(light: UInt32, dark: UInt32) -> Color {
        Color(
            UIColor { traits in
                UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
            }
        )
    }
}

enum FISHColors {
    static let bg = Color.fishToken(light: 0xf8f8f8, dark: 0x0b0b0b)
    static let surface = Color.fishToken(light: 0xffffff, dark: 0x161616)
    static let surface2 = Color.fishToken(light: 0xebebeb, dark: 0x242424)
    static let border = Color.fishToken(light: 0x8c8c8c, dark: 0x717171)
    static let borderStrong = Color.fishToken(light: 0x717171, dark: 0x8f8f8f)

    static let primary = Color.fishToken(light: 0x0b0b0b, dark: 0xf8f8f8)
    static let primaryPress = Color.fishToken(light: 0x222222, dark: 0xdedede)
    static let onPrimary = Color.fishToken(light: 0xf8f8f8, dark: 0x0b0b0b)

    static let foreground = Color.fishToken(light: 0x0b0b0b, dark: 0xf5f5f5)
    static let body = Color.fishToken(light: 0x333333, dark: 0xd7d7d7)
    static let muted = Color.fishToken(light: 0x636363, dark: 0x989898)

    static let notice = Color.fishToken(light: 0x484848, dark: 0xbebebe)
    static let error = Color.fishToken(light: 0x932a33, dark: 0xf69a9a)
    static let warning = Color.fishToken(light: 0x6b4400, dark: 0xe0ae57)
    static let success = Color.fishToken(light: 0x005725, dark: 0x73c385)
}

enum FISHSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
    static let page: CGFloat = 64
}

enum FISHRadius {
    static let control: CGFloat = 12
    static let card: CGFloat = 16
    static let pill: CGFloat = 999
}

enum FISHSizes {
    static let control: CGFloat = 56
    static let icon: CGFloat = 20
    static let progress: CGFloat = 18
    static let helper: CGFloat = 22
    static let content: CGFloat = 440
}

enum FISHStroke {
    static let hairline: CGFloat = 1
    static let focus: CGFloat = 2
    static let icon: CGFloat = 1.5
    static let progress: CGFloat = 2
}

enum FISHShadow {
    static let cardRadius: CGFloat = 16
    static let cardY: CGFloat = 4
    static let cardOpacity: Double = 0.08

    static func cardColor(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? .clear : .black.opacity(cardOpacity)
    }
}

enum FISHOpacity {
    static let hidden: Double = 0
    static let full: Double = 1
    static let disabledContainer: Double = 0.5
    static let disabledContent: Double = 0.65
    static let progressTrack: Double = 0.25
}

enum FISHType {
    static let display = Font.custom("Fraunces-SemiBold", size: 32, relativeTo: .largeTitle)
    static let heading = Font.custom("Fraunces-SemiBold", size: 20, relativeTo: .title3)
    static let body = Font.custom("Lexend-Regular", size: 17, relativeTo: .body)
    static let bodyMedium = Font.custom("Lexend-Medium", size: 17, relativeTo: .body)
    static let label = Font.custom("Lexend-Medium", size: 14, relativeTo: .callout)
    static let caption = Font.custom("Lexend-Regular", size: 14, relativeTo: .caption)
}
