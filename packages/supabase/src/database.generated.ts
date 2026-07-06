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
      onboarding_answers: {
        Row: {
          answer: Json
          answer_type: string
          assessment_version_id: string
          attempt_id: string
          created_at: string
          id: string
          question_config: Json
          question_id: string
          question_key: string
          question_order: number
          question_prompt: string
          updated_at: string
        }
        Insert: {
          answer: Json
          answer_type: string
          assessment_version_id: string
          attempt_id: string
          created_at?: string
          id?: string
          question_config: Json
          question_id: string
          question_key: string
          question_order: number
          question_prompt: string
          updated_at?: string
        }
        Update: {
          answer?: Json
          answer_type?: string
          assessment_version_id?: string
          attempt_id?: string
          created_at?: string
          id?: string
          question_config?: Json
          question_id?: string
          question_key?: string
          question_order?: number
          question_prompt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_answers_assessment_version_id_fkey"
            columns: ["assessment_version_id"]
            isOneToOne: false
            referencedRelation: "onboarding_assessment_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "onboarding_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "onboarding_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_assessment_versions: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          is_active: boolean
          published_at: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          published_at?: string | null
          status: string
          updated_at?: string
          version: number
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          published_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_assessment_versions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "onboarding_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_assessments: {
        Row: {
          created_at: string
          id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_attempts: {
        Row: {
          client_id: string
          current_question_id: string | null
          id: string
          started_at: string
          status: string
          submitted_at: string | null
          updated_at: string
          version_id: string
        }
        Insert: {
          client_id: string
          current_question_id?: string | null
          id?: string
          started_at?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          version_id: string
        }
        Update: {
          client_id?: string
          current_question_id?: string | null
          id?: string
          started_at?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_attempts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_attempts_current_question_id_fkey"
            columns: ["current_question_id"]
            isOneToOne: false
            referencedRelation: "onboarding_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_attempts_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "onboarding_assessment_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_questions: {
        Row: {
          answer_type: string
          config: Json
          created_at: string
          id: string
          prompt: string
          question_key: string
          question_order: number
          updated_at: string
          version_id: string
        }
        Insert: {
          answer_type: string
          config: Json
          created_at?: string
          id?: string
          prompt: string
          question_key: string
          question_order: number
          updated_at?: string
          version_id: string
        }
        Update: {
          answer_type?: string
          config?: Json
          created_at?: string
          id?: string
          prompt?: string
          question_key?: string
          question_order?: number
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_questions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "onboarding_assessment_versions"
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
        }
        Insert: {
          created_at?: string
          display_name?: string
          email?: string
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
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
      message_reads: {
        Row: {
          conversation_id: string
          id: string
          last_read_message_id: string | null
          read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          last_read_message_id?: string | null
          read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          last_read_message_id?: string | null
          read_at?: string
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
          id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          body: string
          client_request_id: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
          sender_role: string
        }
        Update: {
          body?: string
          client_request_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
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
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_assignments: {
        Row: {
          assigned_at: string
          client_id: string
          coach_id: string
          ended_at: string | null
          id: string
          status: string
          version_id: string
        }
        Insert: {
          assigned_at?: string
          client_id: string
          coach_id: string
          ended_at?: string | null
          id?: string
          status?: string
          version_id: string
        }
        Update: {
          assigned_at?: string
          client_id?: string
          coach_id?: string
          ended_at?: string | null
          id?: string
          status?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_assignments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_assignments_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "tracker_config_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_config_versions: {
        Row: {
          cadence: string
          created_at: string
          id: string
          is_active: boolean
          published_at: string | null
          status: string
          tracker_config_id: string
          updated_at: string
          version: number
        }
        Insert: {
          cadence: string
          created_at?: string
          id?: string
          is_active?: boolean
          published_at?: string | null
          status: string
          tracker_config_id: string
          updated_at?: string
          version: number
        }
        Update: {
          cadence?: string
          created_at?: string
          id?: string
          is_active?: boolean
          published_at?: string | null
          status?: string
          tracker_config_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tracker_config_versions_tracker_config_id_fkey"
            columns: ["tracker_config_id"]
            isOneToOne: false
            referencedRelation: "tracker_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_configs: {
        Row: {
          created_at: string
          id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tracker_entries: {
        Row: {
          answer: Json
          answer_type: string
          assignment_id: string
          created_at: string
          entry_date: string
          field_config: Json
          field_id: string
          field_key: string
          field_order: number
          field_prompt: string
          id: string
          updated_at: string
          version_id: string
        }
        Insert: {
          answer: Json
          answer_type: string
          assignment_id: string
          created_at?: string
          entry_date: string
          field_config: Json
          field_id: string
          field_key: string
          field_order: number
          field_prompt: string
          id?: string
          updated_at?: string
          version_id: string
        }
        Update: {
          answer?: Json
          answer_type?: string
          assignment_id?: string
          created_at?: string
          entry_date?: string
          field_config?: Json
          field_id?: string
          field_key?: string
          field_order?: number
          field_prompt?: string
          id?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_entries_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "tracker_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_entries_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "tracker_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_entries_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "tracker_config_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_entry_drafts: {
        Row: {
          answer: Json
          answer_type: string
          assignment_id: string
          created_at: string
          entry_date: string
          field_config: Json
          field_id: string
          field_key: string
          field_order: number
          field_prompt: string
          id: string
          updated_at: string
          version_id: string
        }
        Insert: {
          answer: Json
          answer_type: string
          assignment_id: string
          created_at?: string
          entry_date: string
          field_config: Json
          field_id: string
          field_key: string
          field_order: number
          field_prompt: string
          id?: string
          updated_at?: string
          version_id: string
        }
        Update: {
          answer?: Json
          answer_type?: string
          assignment_id?: string
          created_at?: string
          entry_date?: string
          field_config?: Json
          field_id?: string
          field_key?: string
          field_order?: number
          field_prompt?: string
          id?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_entry_drafts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "tracker_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_entry_drafts_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "tracker_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_entry_drafts_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "tracker_config_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_fields: {
        Row: {
          answer_type: string
          config: Json
          created_at: string
          field_key: string
          field_order: number
          id: string
          prompt: string
          updated_at: string
          version_id: string
        }
        Insert: {
          answer_type: string
          config: Json
          created_at?: string
          field_key: string
          field_order: number
          id?: string
          prompt: string
          updated_at?: string
          version_id: string
        }
        Update: {
          answer_type?: string
          config?: Json
          created_at?: string
          field_key?: string
          field_order?: number
          id?: string
          prompt?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_fields_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "tracker_config_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_milestones: {
        Row: {
          assignment_id: string
          created_at: string
          current_step_progress: number
          id: string
          label: string
          milestone_order: number
          state: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          current_step_progress?: number
          id?: string
          label: string
          milestone_order: number
          state?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          current_step_progress?: number
          id?: string
          label?: string
          milestone_order?: number
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_milestones_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "tracker_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      finalize_onboarding_attempt: {
        Args: never
        Returns: {
          attempt_id: string
          status: string
          submitted_at: string
        }[]
      }
      get_coach_tracker_progress: {
        Args: { p_client_id: string }
        Returns: {
          current_step_progress: number
          entries_count: number
          label: string
          milestone_id: string
          milestone_order: number
          state: string
        }[]
      }
      get_tracker_progress: {
        Args: never
        Returns: {
          current_step_progress: number
          entries_count: number
          label: string
          milestone_id: string
          milestone_order: number
          state: string
        }[]
      }
      save_onboarding_answer: {
        Args: { p_answer: Json; p_question_id: string }
        Returns: {
          answer_id: string
          attempt_id: string
          current_question_id: string
          status: string
        }[]
      }
      save_tracker_draft: {
        Args: { p_answer: Json; p_field_id: string }
        Returns: {
          assignment_id: string
          draft_id: string
          entry_date: string
          status: string
        }[]
      }
      save_tracker_entry: {
        Args: { p_answer: Json; p_field_id: string }
        Returns: {
          assignment_id: string
          entry_date: string
          entry_id: string
          status: string
        }[]
      }
      send_chat_message: {
        Args: {
          p_body: string
          p_client_request_id: string
          p_conversation_id: string
        }
        Returns: {
          body: string
          client_request_id: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          sender_role: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
