import CoreText
import Foundation

public enum Fonts {
    private static let fontFiles = [
        "Lexend[wght]",
        "Fraunces[SOFT,WONK,opsz,wght]",
    ]

    private static let registration: Void = {
        for name in fontFiles {
            // SwiftPM flattens processed resource subdirectories into the
            // module bundle, so the font files resolve at its root.
            guard let url = Bundle.module.url(
                forResource: name,
                withExtension: "ttf"
            ) else {
                assertionFailure("Missing bundled font \(name).ttf")
                continue
            }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }()

    public static func register() {
        _ = registration
    }
}
