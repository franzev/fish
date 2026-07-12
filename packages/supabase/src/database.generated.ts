export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      call_events: {
        Row: {
          actor_id: string | null
          call_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          provider_event_id: string
        }
        Insert: {
          actor_id?: string | null
          call_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          occurred_at: string
          provider_event_id: string
        }
        Update: {
          actor_id?: string | null
          call_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          provider_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_participants: {
        Row: {
          call_id: string
          created_at: string
          invitation_status: Database["public"]["Enums"]["call_invitation_status"]
          joined_at: string | null
          left_at: string | null
          provider_participant_sid: string | null
          reconnect_count: number
          role: Database["public"]["Enums"]["call_participant_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          invitation_status: Database["public"]["Enums"]["call_invitation_status"]
          joined_at?: string | null
          left_at?: string | null
          provider_participant_sid?: string | null
          reconnect_count?: number
          role: Database["public"]["Enums"]["call_participant_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          call_id?: string
          created_at?: string
          invitation_status?: Database["public"]["Enums"]["call_invitation_status"]
          joined_at?: string | null
          left_at?: string | null
          provider_participant_sid?: string | null
          reconnect_count?: number
          role?: Database["public"]["Enums"]["call_participant_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          accepted_at: string | null
          client_id: string
          client_request_id: string
          coach_id: string
          connected_at: string | null
          created_at: string
          end_reason: Database["public"]["Enums"]["call_end_reason"] | null
          ended_at: string | null
          ended_by: string | null
          expires_at: string
          id: string
          initiated_by: string
          kind: Database["public"]["Enums"]["call_kind"]
          provider: string
          provider_room_name: string
          status: Database["public"]["Enums"]["call_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          client_id: string
          client_request_id: string
          coach_id: string
          connected_at?: string | null
          created_at?: string
          end_reason?: Database["public"]["Enums"]["call_end_reason"] | null
          ended_at?: string | null
          ended_by?: string | null
          expires_at: string
          id?: string
          initiated_by: string
          kind?: Database["public"]["Enums"]["call_kind"]
          provider?: string
          provider_room_name: string
          status?: Database["public"]["Enums"]["call_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          client_id?: string
          client_request_id?: string
          coach_id?: string
          connected_at?: string | null
          created_at?: string
          end_reason?: Database["public"]["Enums"]["call_end_reason"] | null
          ended_at?: string | null
          ended_by?: string | null
          expires_at?: string
          id?: string
          initiated_by?: string
          kind?: Database["public"]["Enums"]["call_kind"]
          provider?: string
          provider_room_name?: string
          status?: Database["public"]["Enums"]["call_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          client_request_id: string
          created_at: string
          id: string
          pair_high_id: string
          pair_low_id: string
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: Database["public"]["Enums"]["friend_request_status"]
          updated_at: string
        }
        Insert: {
          client_request_id: string
          created_at?: string
          id?: string
          recipient_id: string
          responded_at?: string | null
          sender_id: string
          status?: Database["public"]["Enums"]["friend_request_status"]
          updated_at?: string
        }
        Update: {
          client_request_id?: string
          created_at?: string
          id?: string
          recipient_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: Database["public"]["Enums"]["friend_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          created_by_request_id: string | null
          id: string
          user_high_id: string
          user_low_id: string
        }
        Insert: {
          created_at?: string
          created_by_request_id?: string | null
          id?: string
          user_high_id: string
          user_low_id: string
        }
        Update: {
          created_at?: string
          created_by_request_id?: string | null
          id?: string
          user_high_id?: string
          user_low_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_created_by_request_id_fkey"
            columns: ["created_by_request_id"]
            isOneToOne: false
            referencedRelation: "friend_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_high_id_fkey"
            columns: ["user_high_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_low_id_fkey"
            columns: ["user_low_id"]
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
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          actor_id: string
          created_at: string
          entity_id: string
          id: string
          kind: Database["public"]["Enums"]["friend_notification_kind"]
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          entity_id: string
          id?: string
          kind: Database["public"]["Enums"]["friend_notification_kind"]
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          entity_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["friend_notification_kind"]
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_call: {
        Args: { p_call_id: string }
        Returns: {
          accepted_at: string | null
          client_id: string
          client_request_id: string
          coach_id: string
          connected_at: string | null
          created_at: string
          end_reason: Database["public"]["Enums"]["call_end_reason"] | null
          ended_at: string | null
          ended_by: string | null
          expires_at: string
          id: string
          initiated_by: string
          kind: Database["public"]["Enums"]["call_kind"]
          provider: string
          provider_room_name: string
          status: Database["public"]["Enums"]["call_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "calls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      block_user: {
        Args: { p_target_id: string }
        Returns: boolean
      }
      cancel_call: {
        Args: { p_call_id: string }
        Returns: {
          accepted_at: string | null
          client_id: string
          client_request_id: string
          coach_id: string
          connected_at: string | null
          created_at: string
          end_reason: Database["public"]["Enums"]["call_end_reason"] | null
          ended_at: string | null
          ended_by: string | null
          expires_at: string
          id: string
          initiated_by: string
          kind: Database["public"]["Enums"]["call_kind"]
          provider: string
          provider_room_name: string
          status: Database["public"]["Enums"]["call_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "calls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_friend_request: {
        Args: { p_request_id: string }
        Returns: {
          client_request_id: string
          created_at: string
          id: string
          pair_high_id: string
          pair_low_id: string
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: Database["public"]["Enums"]["friend_request_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "friend_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      end_call: {
        Args: { p_call_id: string }
        Returns: {
          accepted_at: string | null
          client_id: string
          client_request_id: string
          coach_id: string
          connected_at: string | null
          created_at: string
          end_reason: Database["public"]["Enums"]["call_end_reason"] | null
          ended_at: string | null
          ended_by: string | null
          expires_at: string
          id: string
          initiated_by: string
          kind: Database["public"]["Enums"]["call_kind"]
          provider: string
          provider_room_name: string
          status: Database["public"]["Enums"]["call_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "calls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_stale_calls: { Args: { p_now?: string }; Returns: number }
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
      initiate_call: {
        Args: {
          p_client_request_id: string
          p_kind: Database["public"]["Enums"]["call_kind"]
          p_recipient_id: string
        }
        Returns: {
          accepted_at: string | null
          client_id: string
          client_request_id: string
          coach_id: string
          connected_at: string | null
          created_at: string
          end_reason: Database["public"]["Enums"]["call_end_reason"] | null
          ended_at: string | null
          ended_by: string | null
          expires_at: string
          id: string
          initiated_by: string
          kind: Database["public"]["Enums"]["call_kind"]
          provider: string
          provider_room_name: string
          status: Database["public"]["Enums"]["call_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "calls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      join_call: {
        Args: { p_call_id: string }
        Returns: {
          accepted_at: string | null
          client_id: string
          client_request_id: string
          coach_id: string
          connected_at: string | null
          created_at: string
          end_reason: Database["public"]["Enums"]["call_end_reason"] | null
          ended_at: string | null
          ended_by: string | null
          expires_at: string
          id: string
          initiated_by: string
          kind: Database["public"]["Enums"]["call_kind"]
          provider: string
          provider_room_name: string
          status: Database["public"]["Enums"]["call_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "calls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      list_blocked_users: {
        Args: never
        Returns: {
          display_name: string
          user_id: string
          username: string
        }[]
      }
      list_friend_notifications: {
        Args: { p_limit?: number }
        Returns: {
          actor_display_name: string
          actor_id: string
          actor_username: string
          created_at: string
          entity_id: string
          id: string
          kind: Database["public"]["Enums"]["friend_notification_kind"]
          read_at: string | null
        }[]
      }
      list_friends: {
        Args: {
          p_cursor_created_at?: string
          p_cursor_id?: string
          p_limit?: number
        }
        Returns: {
          created_at: string
          display_name: string
          friend_id: string
          friendship_id: string
          username: string
        }[]
      }
      list_incoming_friend_requests: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          request_id: string
          sender_id: string
          username: string
        }[]
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
      mark_friend_notifications_read: {
        Args: { p_notification_ids: string[] }
        Returns: number
      }
      reconcile_livekit_webhook: {
        Args: {
          p_event_type: string
          p_occurred_at: string
          p_participant_id: string
          p_participant_sid: string
          p_provider_event_id: string
          p_room_name: string
        }
        Returns: string
      }
      reject_call: {
        Args: { p_call_id: string }
        Returns: {
          accepted_at: string | null
          client_id: string
          client_request_id: string
          coach_id: string
          connected_at: string | null
          created_at: string
          end_reason: Database["public"]["Enums"]["call_end_reason"] | null
          ended_at: string | null
          ended_by: string | null
          expires_at: string
          id: string
          initiated_by: string
          kind: Database["public"]["Enums"]["call_kind"]
          provider: string
          provider_room_name: string
          status: Database["public"]["Enums"]["call_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "calls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_friend: {
        Args: { p_target_id: string }
        Returns: boolean
      }
      respond_friend_request: {
        Args: { p_request_id: string; p_response: string }
        Returns: {
          client_request_id: string
          created_at: string
          id: string
          pair_high_id: string
          pair_low_id: string
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: Database["public"]["Enums"]["friend_request_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "friend_requests"
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
      search_friend_candidate: {
        Args: { p_username: string }
        Returns: Json
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
      send_friend_request: {
        Args: { p_client_request_id: string; p_target_id: string }
        Returns: {
          client_request_id: string
          created_at: string
          id: string
          pair_high_id: string
          pair_low_id: string
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: Database["public"]["Enums"]["friend_request_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "friend_requests"
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
      unblock_user: {
        Args: { p_target_id: string }
        Returns: boolean
      }
    }
    Enums: {
      call_end_reason:
        | "completed"
        | "rejected"
        | "caller_cancelled"
        | "no_answer"
        | "permission_denied"
        | "connect_failed"
        | "network_lost"
        | "provider_error"
      call_invitation_status: "invited" | "accepted" | "rejected"
      call_kind: "audio" | "video"
      call_participant_role: "host" | "invitee"
      call_status:
        | "ringing"
        | "connecting"
        | "active"
        | "ended"
        | "rejected"
        | "cancelled"
        | "missed"
        | "failed"
      friend_notification_kind:
        | "friend_request_received"
        | "friend_request_accepted"
      friend_request_status: "pending" | "accepted" | "declined" | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      call_end_reason: [
        "completed",
        "rejected",
        "caller_cancelled",
        "no_answer",
        "permission_denied",
        "connect_failed",
        "network_lost",
        "provider_error",
      ],
      call_invitation_status: ["invited", "accepted", "rejected"],
      call_kind: ["audio", "video"],
      call_participant_role: ["host", "invitee"],
      call_status: [
        "ringing",
        "connecting",
        "active",
        "ended",
        "rejected",
        "cancelled",
        "missed",
        "failed",
      ],
    },
  },
} as const
