import ChatData
import DesignSystem
import SwiftUI
import Testing
@testable import PersonalChat

struct VoiceMessageTests {
    @Test func holdControlUsesTheExpectedCancelDirection() {
        #expect(VoiceRecordingControl.isCancelTranslation(
            -Metrics.controlPrimary,
            layoutDirection: .leftToRight
        ))
        #expect(!VoiceRecordingControl.isCancelTranslation(
            Metrics.controlPrimary,
            layoutDirection: .leftToRight
        ))
        #expect(VoiceRecordingControl.isCancelTranslation(
            Metrics.controlPrimary,
            layoutDirection: .rightToLeft
        ))
        #expect(VoiceRecordingControl.durationLabel(65.9) == "1:05")
    }

    @Test func audioAttachmentsAreVoiceMessagesAndSpeakClearly() {
        let attachment = MessageAttachmentUiModel(
            attachment: ChatAttachment(
                id: "voice-1",
                kind: .file,
                originalName: "Voice message.m4a",
                mimeType: "audio/mp4",
                byteSize: 4_096,
                displayPath: "chat/voice-1.m4a"
            )
        )
        #expect(attachment.isVoiceMessage)
        #expect(AttachmentAccessibility.fileTypeLabel(attachment.mimeType) == "Voice message")
        #expect(AttachmentAccessibility.messageDescription([attachment])?.contains("voice message") == true)
    }
}
