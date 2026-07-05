import CoreText
import Foundation

enum FontRegistry {
    private static let bundledFonts = ["Lexend", "Fraunces"]
    private static var didRegister = false

    static func registerAll() {
        guard !didRegister else { return }

        bundledFonts.forEach { name in
            guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else {
                return
            }

            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }

        didRegister = true
    }
}
