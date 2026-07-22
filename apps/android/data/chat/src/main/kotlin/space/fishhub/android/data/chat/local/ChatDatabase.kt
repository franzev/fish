package space.fishhub.android.data.chat.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        ConversationEntity::class,
        MessageEntity::class,
        MessageAttachmentEntity::class,
        ReadStateEntity::class,
        DraftEntity::class,
        PendingTextSendEntity::class,
        AttachmentDraftEntity::class,
    ],
    version = 8,
    exportSchema = true,
)
abstract class ChatDatabase : RoomDatabase() {
    abstract fun chatDao(): ChatDao
}

val MIGRATION_1_2: Migration = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE messages ADD COLUMN sticker_id TEXT")
        db.execSQL("ALTER TABLE messages ADD COLUMN gif_json TEXT")
    }
}

val MIGRATION_2_3: Migration = object : Migration(2, 3) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `message_attachments` (
                `id` TEXT NOT NULL,
                `message_id` TEXT NOT NULL,
                `conversation_id` TEXT NOT NULL,
                `position` INTEGER NOT NULL,
                `kind` TEXT NOT NULL,
                `available` INTEGER NOT NULL,
                `original_name` TEXT NOT NULL,
                `stored_mime_type` TEXT,
                `stored_byte_size` INTEGER,
                `width` INTEGER,
                `height` INTEGER,
                `thumbnail_path` TEXT,
                `display_path` TEXT,
                PRIMARY KEY(`id`),
                FOREIGN KEY(`message_id`) REFERENCES `messages`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
            )
            """.trimIndent(),
        )
        db.execSQL(
            "CREATE UNIQUE INDEX IF NOT EXISTS `index_message_attachments_message_id_position` " +
                "ON `message_attachments` (`message_id`, `position`)",
        )
        db.execSQL(
            "CREATE INDEX IF NOT EXISTS `index_message_attachments_conversation_id_message_id` " +
                "ON `message_attachments` (`conversation_id`, `message_id`)",
        )
    }
}

val MIGRATION_3_4: Migration = object : Migration(3, 4) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `attachment_drafts` (
                `id` TEXT NOT NULL,
                `conversation_id` TEXT NOT NULL,
                `user_id` TEXT NOT NULL,
                `position` INTEGER NOT NULL,
                `kind` TEXT NOT NULL,
                `scope` TEXT NOT NULL,
                `display_name` TEXT NOT NULL,
                `source_mime_type` TEXT NOT NULL,
                `stored_mime_type` TEXT NOT NULL,
                `byte_size` INTEGER NOT NULL,
                `width` INTEGER,
                `height` INTEGER,
                `local_path` TEXT NOT NULL,
                `thumbnail_path` TEXT,
                `sha256` TEXT NOT NULL,
                `created_at` TEXT NOT NULL,
                `updated_at` TEXT NOT NULL,
                `expires_at` TEXT NOT NULL,
                PRIMARY KEY(`id`)
            )
            """.trimIndent(),
        )
        db.execSQL(
            "CREATE UNIQUE INDEX IF NOT EXISTS `index_attachment_drafts_conversation_id_user_id_scope_position` " +
                "ON `attachment_drafts` (`conversation_id`, `user_id`, `scope`, `position`)",
        )
        db.execSQL(
            "CREATE UNIQUE INDEX IF NOT EXISTS `index_attachment_drafts_conversation_id_user_id_sha256` " +
                "ON `attachment_drafts` (`conversation_id`, `user_id`, `sha256`)",
        )
        db.execSQL(
            "CREATE INDEX IF NOT EXISTS `index_attachment_drafts_expires_at` " +
                "ON `attachment_drafts` (`expires_at`)",
        )
    }
}

val MIGRATION_4_5: Migration = object : Migration(4, 5) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE attachment_drafts ADD COLUMN client_upload_id TEXT NOT NULL DEFAULT ''")
        db.execSQL("ALTER TABLE attachment_drafts ADD COLUMN source_byte_size INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE attachment_drafts ADD COLUMN server_attachment_id TEXT")
        db.execSQL("ALTER TABLE attachment_drafts ADD COLUMN transfer_state TEXT NOT NULL DEFAULT 'selected'")
        db.execSQL("ALTER TABLE attachment_drafts ADD COLUMN progress_bytes INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE attachment_drafts ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE attachment_drafts ADD COLUMN failure_code TEXT")
        db.execSQL("ALTER TABLE attachment_drafts ADD COLUMN retry_after TEXT")
        db.execSQL("ALTER TABLE attachment_drafts ADD COLUMN tus_upload_url TEXT")
        db.execSQL("ALTER TABLE attachment_drafts ADD COLUMN tus_upload_offset INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE attachment_drafts ADD COLUMN tus_expires_at TEXT")
        db.execSQL("UPDATE attachment_drafts SET client_upload_id = id WHERE client_upload_id = ''")
        db.execSQL("UPDATE attachment_drafts SET source_byte_size = byte_size WHERE source_byte_size = 0")
    }
}

val MIGRATION_5_6: Migration = object : Migration(5, 6) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE messages ADD COLUMN reactions_json TEXT")
    }
}

val MIGRATION_6_7: Migration = object : Migration(6, 7) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE messages ADD COLUMN link_preview_json TEXT")
    }
}

val MIGRATION_7_8: Migration = object : Migration(7, 8) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `pending_text_sends` (
                `conversation_id` TEXT NOT NULL,
                `user_id` TEXT NOT NULL,
                `client_request_id` TEXT NOT NULL,
                `body` TEXT NOT NULL,
                `reply_to_message_id` TEXT,
                `created_at` TEXT NOT NULL,
                PRIMARY KEY(`conversation_id`, `user_id`, `client_request_id`)
            )
            """.trimIndent(),
        )
        db.execSQL(
            "CREATE INDEX IF NOT EXISTS `index_pending_text_sends_conversation_id_user_id_created_at` " +
                "ON `pending_text_sends` (`conversation_id`, `user_id`, `created_at`)",
        )
    }
}
