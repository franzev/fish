export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      channel_members: {
        Row: {
          channel_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          consent_version: string | null
          consented: boolean
          consented_at: string | null
          created_at: string
          goal: string
          id: string
          level: string | null
          locale: string | null
          reduced_motion_pref: boolean | null
          text_size_pref: string | null
          theme_pref: string | null
          time_format_pref: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          consent_version?: string | null
          consented?: boolean
          consented_at?: string | null
          created_at?: string
          goal?: string
          id: string
          level?: string | null
          locale?: string | null
          reduced_motion_pref?: boolean | null
          text_size_pref?: string | null
          theme_pref?: string | null
          time_format_pref?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          consent_version?: string | null
          consented?: boolean
          consented_at?: string | null
          created_at?: string
          goal?: string
          id?: string
          level?: string | null
          locale?: string | null
          reduced_motion_pref?: boolean | null
          text_size_pref?: string | null
          theme_pref?: string | null
          time_format_pref?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_clients: {
        Row: {
          assigned_at: string
          client_id: string
          coach_id: string
        }
        Insert: {
          assigned_at?: string
          client_id: string
          coach_id: string
        }
        Update: {
          assigned_at?: string
          client_id?: string
          coach_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_clients_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          client_upload_id: string
          conversation_id: string
          created_at: string
          display_path: string | null
          expires_at: string
          failure_code: string | null
          height: number | null
          id: string
          kind: string
          message_id: string | null
          original_name: string
          position: number | null
          source_byte_size: number
          source_mime_type: string
          staging_path: string
          status: string
          stored_byte_size: number | null
          stored_mime_type: string | null
          thumbnail_path: string | null
          updated_at: string
          uploader_id: string
          width: number | null
        }
        Insert: {
          client_upload_id: string
          conversation_id: string
          created_at?: string
          display_path?: string | null
          expires_at?: string
          failure_code?: string | null
          height?: number | null
          id?: string
          kind?: string
          message_id?: string | null
          original_name: string
          position?: number | null
          source_byte_size: number
          source_mime_type: string
          staging_path: string
          status?: string
          stored_byte_size?: number | null
          stored_mime_type?: string | null
          thumbnail_path?: string | null
          updated_at?: string
          uploader_id: string
          width?: number | null
        }
        Update: {
          client_upload_id?: string
          conversation_id?: string
          created_at?: string
          display_path?: string | null
          expires_at?: string
          failure_code?: string | null
          height?: number | null
          id?: string
          kind?: string
          message_id?: string | null
          original_name?: string
          position?: number | null
          source_byte_size?: number
          source_mime_type?: string
          staging_path?: string
          status?: string
          stored_byte_size?: number | null
          stored_mime_type?: string | null
          thumbnail_path?: string | null
          updated_at?: string
          uploader_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_embeds: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          url: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
          url: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_embeds_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_embeds_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_mentions: {
        Row: {
          conversation_id: string
          mentioned_user_id: string
          message_id: string
        }
        Insert: {
          conversation_id: string
          mentioned_user_id: string
          message_id: string
        }
        Update: {
          conversation_id?: string
          mentioned_user_id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_mentions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          conversation_id: string
          created_at: string
          emoji: string
          id: string
          message_id: string
          removed_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          removed_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          removed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          conversation_id: string
          delivered_at: string | null
          id: string
          last_delivered_message_id: string | null
          last_read_message_id: string | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          delivered_at?: string | null
          id?: string
          last_delivered_message_id?: string | null
          last_read_message_id?: string | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          delivered_at?: string | null
          id?: string
          last_delivered_message_id?: string | null
          last_read_message_id?: string | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_last_delivered_message_id_fkey"
            columns: ["last_delivered_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          client_request_id: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          pinned_at: string | null
          pinned_by: string | null
          reply_to_message_id: string | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          body?: string
          client_request_id: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_message_id?: string | null
          sender_id: string
          sender_role: string
        }
        Update: {
          body?: string
          client_request_id?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_message_id?: string | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      presence_sessions: {
        Row: {
          active_at: string
          ended_at: string | null
          id: string
          last_heartbeat_at: string
          started_at: string
          user_id: string
        }
        Insert: {
          active_at?: string
          ended_at?: string | null
          id: string
          last_heartbeat_at?: string
          started_at?: string
          user_id: string
        }
        Update: {
          active_at?: string
          ended_at?: string | null
          id?: string
          last_heartbeat_at?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presence_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          role: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          email?: string
          id: string
          role?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_chat_messages: {
        Args: {
          p_author_types?: string[]
          p_channel_ids?: string[]
          p_content_kinds?: string[]
          p_conversation_id: string
          p_dates?: Json
          p_mentioned_user_ids?: string[]
          p_pinned?: boolean
          p_query?: string
          p_sender_ids?: string[]
        }
        Returns: number
      }
      delete_chat_message: {
        Args: { p_message_id: string }
        Returns: {
          body: string
          client_request_id: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          pinned_at: string | null
          pinned_by: string | null
          reply_to_message_id: string | null
          sender_id: string
          sender_role: string
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      edit_chat_message: {
        Args: { p_body: string; p_message_id: string }
        Returns: {
          body: string
          client_request_id: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          pinned_at: string | null
          pinned_by: string | null
          reply_to_message_id: string | null
          sender_id: string
          sender_role: string
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_unattached_chat_images: {
        Args: never
        Returns: {
          client_upload_id: string
          conversation_id: string
          created_at: string
          display_path: string | null
          expires_at: string
          failure_code: string | null
          height: number | null
          id: string
          kind: string
          message_id: string | null
          original_name: string
          position: number | null
          source_byte_size: number
          source_mime_type: string
          staging_path: string
          status: string
          stored_byte_size: number | null
          stored_mime_type: string | null
          thumbnail_path: string | null
          updated_at: string
          uploader_id: string
          width: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "message_attachments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      initialize_chat_image_upload: {
        Args: {
          p_client_upload_id: string
          p_conversation_id: string
          p_original_name: string
          p_source_byte_size: number
          p_source_mime_type: string
        }
        Returns: {
          client_upload_id: string
          conversation_id: string
          created_at: string
          display_path: string | null
          expires_at: string
          failure_code: string | null
          height: number | null
          id: string
          kind: string
          message_id: string | null
          original_name: string
          position: number | null
          source_byte_size: number
          source_mime_type: string
          staging_path: string
          status: string
          stored_byte_size: number | null
          stored_mime_type: string | null
          thumbnail_path: string | null
          updated_at: string
          uploader_id: string
          width: number | null
        }
        SetofOptions: {
          from: "*"
          to: "message_attachments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_chat_read_state: {
        Args: {
          p_conversation_id: string
          p_last_delivered_message_id?: string
          p_last_read_message_id?: string
        }
        Returns: {
          conversation_id: string
          delivered_at: string | null
          id: string
          last_delivered_message_id: string | null
          last_read_message_id: string | null
          read_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "message_reads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_chat_messages: {
        Args: {
          p_author_types?: string[]
          p_before_created_at?: string
          p_before_id?: string
          p_channel_ids?: string[]
          p_content_kinds?: string[]
          p_conversation_id: string
          p_dates?: Json
          p_limit?: number
          p_mentioned_user_ids?: string[]
          p_offset?: number
          p_pinned?: boolean
          p_query?: string
          p_sender_ids?: string[]
          p_sort_direction?: string
        }
        Returns: {
          body: string
          client_request_id: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          pinned_at: string | null
          pinned_by: string | null
          reply_to_message_id: string | null
          sender_id: string
          sender_role: string
        }[]
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      send_chat_message: {
        Args: {
          p_attachment_ids?: string[]
          p_body: string
          p_client_request_id: string
          p_conversation_id: string
          p_reply_to_message_id?: string
        }
        Returns: {
          body: string
          client_request_id: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          pinned_at: string | null
          pinned_by: string | null
          reply_to_message_id: string | null
          sender_id: string
          sender_role: string
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      toggle_message_reaction: {
        Args: { p_emoji: string; p_message_id: string }
        Returns: {
          body: string
          client_request_id: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          pinned_at: string | null
          pinned_by: string | null
          reply_to_message_id: string | null
          sender_id: string
          sender_role: string
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
