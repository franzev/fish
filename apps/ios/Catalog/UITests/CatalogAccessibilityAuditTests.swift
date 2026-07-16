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
        ]

        for page in pages {
            let link = app.buttons[page].firstMatch
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

                return decorativeSkeleton || scrollableEmail
            }
            app.navigationBars.buttons.element(boundBy: 0).tap()
        }

        app.buttons["Chat states"].firstMatch.tap()
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
