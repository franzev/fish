import SwiftUI
import UIKit

/// Semantic names over the bundled Tabler outline set. Feature code never
/// references asset filenames directly.
public enum Icon: String, CaseIterable, Sendable {
    case back = "arrow-left"
    case send
    case retry = "rotate"
    case close = "x"
    case person = "user"
    case lock
    case info = "info-circle"
    case warning = "alert-triangle"
    case alert = "alert-circle"
    case check
    case checkDouble = "checks"
    case moodSmile = "mood-smile"
    case search
    case handStop = "hand-stop"
    case paw
    case toolsKitchen = "tools-kitchen-2"
    case car
    case ballBasketball = "ball-basketball"
    case bulb
    case hash
    case flag
    case play = "player-play"
    case pause = "player-pause"
    case phone
    case phoneOff = "phone-off"
    case video
    case videoOff = "video-off"
    case microphone
    case microphoneOff = "microphone-off"
    case settings
    case messages
    case speaker = "volume"
    case cameraFlip = "camera-rotate"
    case circle
    case circleFilled = "circle-filled"
    case circleMinus = "circle-minus"
    case clock
    case eyeOff = "eye-off"
    case moonFilled = "moon-filled"
    case paperclip
    case photo
    case fileText = "file-text"
    case link
    case download
    case share
    case chevronLeft = "chevron-left"
    case chevronRight = "chevron-right"

    public var isDirectional: Bool {
        self == .back || self == .chevronLeft || self == .chevronRight
    }

    @MainActor public var image: some View {
        Image(rawValue, bundle: .module)
            .renderingMode(.template)
            .resizable()
            .scaledToFit()
            .flipsForRightToLeftLayoutDirection(isDirectional)
            .accessibilityHidden(true)
    }

    @MainActor var uiImage: UIImage? {
        UIImage(named: rawValue, in: .module, with: nil)
    }
}

extension View {
    public func glyphFrame() -> some View {
        frame(width: Metrics.iconGlyph, height: Metrics.iconGlyph)
    }
}
