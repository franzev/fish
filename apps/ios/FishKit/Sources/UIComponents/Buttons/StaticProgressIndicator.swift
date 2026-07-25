import DesignSystem
import SwiftUI

struct StaticProgressIndicator: View {
    var body: some View {
        Circle()
            .trim(from: 0.12, to: 0.82)
            .stroke(
                style: StrokeStyle(
                    lineWidth: 2,
                    lineCap: .round
                )
            )
            .rotationEffect(.degrees(-90))
            .frame(width: 20, height: 20)
            .accessibilityHidden(true)
    }
}
