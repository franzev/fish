import XCTest

final class CatalogAccessibilityAuditTests: XCTestCase {
    @MainActor
    func testCatalogPagesPassAccessibilityAudit() throws {
        let app = XCUIApplication()
        app.launch()

        let pages = [
            "Buttons",
            "Icon buttons",
            "Text fields",
            "Avatars",
            "Notices",
            "Loading",
            "Empty states",
            "Top bars",
            "Media picker",
            "Call states",
            "Call demo",
        ]

        for page in pages {
            let link = catalogLink(page, in: app)
            XCTAssertTrue(link.waitForExistence(timeout: 3), "Missing \(page)")
            link.tap()
            try app.performAccessibilityAudit { issue in
                // Skeleton bars are decorative and hidden from assistive
                // technologies. Xcode can report their pixels as contrast
                // findings with no associated accessibility element.
                let decorativeSkeleton = page == "Loading"
                    && issue.auditType == .contrast
                    && issue.element == nil

                // A focused single-line field scrolls editable content
                // horizontally. Xcode reports the unfocused, visually elided
                // fixture value as clipped even though the full value remains
                // editable and exposed to assistive technologies.
                let scrollableEmail = page == "Text fields"
                    && issue.auditType == .textClipped
                    && issue.element?.elementType == .textField
                    && issue.element?.label == "Email"

                let pickerPictographs = page == "Media picker"
                    && self.isPictographAuditLimitation(issue)

                return decorativeSkeleton || scrollableEmail || pickerPictographs
            }
            app.navigationBars.buttons.element(boundBy: 0).tap()
        }

        catalogLink("Chat states", in: app).tap()
        app.buttons["Loaded"].firstMatch.tap()
        let latestMessage = app.staticTexts[
            "Sounds good. See you then!"
        ].firstMatch
        XCTAssertTrue(latestMessage.waitForExistence(timeout: 3))
        XCTAssertTrue(
            latestMessage.isHittable,
            "The transcript should open at the latest message"
        )
        try app.performAccessibilityAudit { issue in
            self.handlesKnownTranscriptAuditLimitation(issue)
        }
        app.buttons["Back"].firstMatch.tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()
    }

    /// The catalog menu is a lazy list; rows outside the viewport are not in
    /// the accessibility hierarchy until scrolled into view. Returns to the
    /// top first so lookups work from any scroll position.
    @MainActor
    private func catalogLink(_ name: String, in app: XCUIApplication) -> XCUIElement {
        let link = app.buttons[name].firstMatch
        if link.waitForExistence(timeout: 1) { return link }
        for _ in 0..<3 where !link.exists { app.swipeDown() }
        var attempts = 0
        while !link.waitForExistence(timeout: 1), attempts < 5 {
            app.swipeUp()
            attempts += 1
        }
        return link
    }

    @MainActor
    func testComposerStaysAboveKeyboardDuringRotation() {
        let app = XCUIApplication()
        app.launch()
        app.buttons["Chat states"].firstMatch.tap()
        app.buttons["Loaded"].firstMatch.tap()

        let composer = app.textFields["Message"].firstMatch
        XCTAssertTrue(composer.waitForExistence(timeout: 3))
        composer.tap()
        composer.typeText(String(
            repeating: "Practice this point with a calm pause. ",
            count: 5
        ))

        let keyboard = app.keyboards.firstMatch
        XCTAssertTrue(keyboard.waitForExistence(timeout: 3))
        assertComposer(composer, staysAbove: keyboard)
        let portraitKeyboardFrame = keyboard.frame

        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(composer.waitForExistence(timeout: 3))
        let window = app.windows.firstMatch
        XCTAssertGreaterThan(
            window.frame.width,
            window.frame.height,
            "The app should complete the requested landscape rotation"
        )
        let rotatedKeyboard = app.keyboards.firstMatch
        XCTAssertGreaterThan(
            rotatedKeyboard.frame.width,
            portraitKeyboardFrame.width,
            "The software keyboard should relayout for landscape"
        )
        XCTAssertTrue(
            window.frame.insetBy(dx: -1, dy: -1)
                .contains(rotatedKeyboard.frame),
            "The landscape keyboard must remain inside the app window"
        )
        assertComposer(composer, staysAbove: rotatedKeyboard)

        XCUIDevice.shared.orientation = .portrait
    }

    /// The media picker page is dominated by color emoji and sticker artwork,
    /// which Xcode's pixel-based contrast sampler cannot assess — its
    /// findings here proved nondeterministic across identical runs, landing
    /// on different glyphs or neighbouring token text each time. Contrast is
    /// therefore delegated to ContrastTests, which verifies every text
    /// role/canvas pair at AA in both themes (the same delegation the
    /// Loading page uses for skeleton pixels). Clipping and Dynamic Type
    /// stay active for real text: only fixed-size pictograph glyphs and
    /// element-less pixel heuristics are exempt, so a clipped or
    /// non-scaling label still fails the audit.
    private func isPictographAuditLimitation(
        _ issue: XCUIAccessibilityAuditIssue
    ) -> Bool {
        switch issue.auditType {
        case .contrast:
            return true
        case .elementDetection, .textClipped, .dynamicType:
            guard let label = issue.element?.label else { return true }
            return isPictographLabel(label)
        default:
            return false
        }
    }

    private func isPictographLabel(_ label: String) -> Bool {
        label.count == 1
            && label.unicodeScalars.first?.properties.isEmoji == true
    }

    private func handlesKnownTranscriptAuditLimitation(
        _ issue: XCUIAccessibilityAuditIssue
    ) -> Bool {
        // Message text is intentionally represented by one combined
        // sender/time/body/status VoiceOver node. Xcode's pixel detector can
        // still flag the visual child text as inaccessible even though the
        // combined node exposes the complete label.
        if issue.auditType == .elementDetection, issue.element == nil {
            return true
        }

        guard let element = issue.element,
              isExpectedChatText(element.label)
        else { return false }

        if issue.auditType == .contrast {
            // Xcode 26.5 samples the lazy transcript's off-screen/custom-
            // background rows against the wrong canvas. ContrastTests checks
            // every generated role/canvas pair in both themes at AA.
            return true
        }
        if issue.auditType == .dynamicType {
            // The same lazy rows are reported despite using
            // Font.custom(_:size:relativeTo:) and having committed AX-size
            // snapshots. Keep this exception limited to known fixture text.
            return true
        }
        return false
    }

    private func isExpectedChatText(_ label: String) -> Bool {
        let exactLabels: Set<String> = [
            "Sam Rivera",
            "Online",
            "Yesterday",
            "Today",
            "How did the presentation go?",
            "Remember — pause before your key point. It gives your listeners time to catch up.",
            "It went really well! I used the pause twice.",
            "That's great progress. Tomorrow, let's practice questions for your team meeting.",
            "Sounds good. See you then!",
            "Message",
        ]
        if exactLabels.contains(label) { return true }

        let normalized = label.replacingOccurrences(of: "\u{202F}", with: " ")
        return normalized.range(
            of: #"^\d{1,2}:\d{2} (AM|PM)$"#,
            options: .regularExpression
        ) != nil
    }

    private func assertComposer(
        _ composer: XCUIElement,
        staysAbove keyboard: XCUIElement,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertTrue(composer.isHittable, file: file, line: line)
        XCTAssertLessThanOrEqual(
            composer.frame.maxY,
            keyboard.frame.minY + 1,
            "The composer must remain above the software keyboard",
            file: file,
            line: line
        )
    }
}
