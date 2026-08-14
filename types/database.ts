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
      body_metrics: {
        Row: {
          date: string
          id: string
          metric_id: string
          note: string | null
          user_id: string
          value: number
        }
        Insert: {
          date: string
          id?: string
          metric_id: string
          note?: string | null
          user_id: string
          value: number
        }
        Update: {
          date?: string
          id?: string
          metric_id?: string
          note?: string | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "body_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_stats: {
        Row: {
          cardio_minutes: number
          date: string
          session_count: number
          sets_by_muscle: Json
          total_duration_s: number
          total_volume_kg: number
          updated_at: string
          user_id: string
          was_planned: boolean
        }
        Insert: {
          cardio_minutes?: number
          date: string
          session_count?: number
          sets_by_muscle?: Json
          total_duration_s?: number
          total_volume_kg?: number
          updated_at?: string
          user_id: string
          was_planned?: boolean
        }
        Update: {
          cardio_minutes?: number
          date?: string
          session_count?: number
          sets_by_muscle?: Json
          total_duration_s?: number
          total_volume_kg?: number
          updated_at?: string
          user_id?: string
          was_planned?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "daily_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          duration_max_s: number | null
          duration_min_s: number | null
          equipment: string[]
          id: string
          is_key_lift: boolean
          is_public: boolean
          kind: string
          muscle: string
          name: string
          note: string | null
          owner_id: string | null
          per_side: boolean
          rep_max: number | null
          rep_min: number | null
          secondary: string[]
        }
        Insert: {
          duration_max_s?: number | null
          duration_min_s?: number | null
          equipment?: string[]
          id: string
          is_key_lift?: boolean
          is_public?: boolean
          kind: string
          muscle: string
          name: string
          note?: string | null
          owner_id?: string | null
          per_side?: boolean
          rep_max?: number | null
          rep_min?: number | null
          secondary?: string[]
        }
        Update: {
          duration_max_s?: number | null
          duration_min_s?: number | null
          equipment?: string[]
          id?: string
          is_key_lift?: boolean
          is_public?: boolean
          kind?: string
          muscle?: string
          name?: string
          note?: string | null
          owner_id?: string | null
          per_side?: boolean
          rep_max?: number | null
          rep_min?: number | null
          secondary?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "exercises_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_days: {
        Row: {
          day_of_week: number | null
          focus: string[]
          id: string
          is_cardio_day: boolean
          is_priority_day: boolean
          is_rest: boolean
          label: string
          note: string | null
          plan_id: string
          rest_note: string | null
        }
        Insert: {
          day_of_week?: number | null
          focus?: string[]
          id?: string
          is_cardio_day?: boolean
          is_priority_day?: boolean
          is_rest?: boolean
          label: string
          note?: string | null
          plan_id: string
          rest_note?: string | null
        }
        Update: {
          day_of_week?: number | null
          focus?: string[]
          id?: string
          is_cardio_day?: boolean
          is_priority_day?: boolean
          is_rest?: boolean
          label?: string
          note?: string | null
          plan_id?: string
          rest_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_items: {
        Row: {
          exercise_id: string
          id: string
          is_key: boolean
          note: string | null
          order_index: number
          per_side: boolean
          plan_day_id: string
          target_duration_max_s: number | null
          target_duration_min_s: number | null
          target_rep_max: number | null
          target_rep_min: number | null
          target_sets: number
        }
        Insert: {
          exercise_id: string
          id?: string
          is_key?: boolean
          note?: string | null
          order_index: number
          per_side?: boolean
          plan_day_id: string
          target_duration_max_s?: number | null
          target_duration_min_s?: number | null
          target_rep_max?: number | null
          target_rep_min?: number | null
          target_sets: number
        }
        Update: {
          exercise_id?: string
          id?: string
          is_key?: boolean
          note?: string | null
          order_index?: number
          per_side?: boolean
          plan_day_id?: string
          target_duration_max_s?: number | null
          target_duration_min_s?: number | null
          target_rep_max?: number | null
          target_rep_min?: number | null
          target_sets?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_items_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "plan_days"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          seed_id: string | null
          split_type: string | null
          use_when: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          seed_id?: string | null
          split_type?: string | null
          use_when?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          seed_id?: string | null
          split_type?: string | null
          use_when?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_photos: {
        Row: {
          created_at: string
          date: string
          id: string
          is_private: boolean
          pose: string | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_private?: boolean
          pose?: string | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_private?: boolean
          pose?: string | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_sets: {
        Row: {
          client_id: string
          completed_at: string
          distance_m: number | null
          duration_s: number | null
          exercise_id: string
          id: string
          incline_pct: number | null
          is_warmup: boolean
          reps: number | null
          rir: number | null
          session_id: string
          set_index: number
          side: string | null
          weight_kg: number | null
        }
        Insert: {
          client_id: string
          completed_at?: string
          distance_m?: number | null
          duration_s?: number | null
          exercise_id: string
          id?: string
          incline_pct?: number | null
          is_warmup?: boolean
          reps?: number | null
          rir?: number | null
          session_id: string
          set_index: number
          side?: string | null
          weight_kg?: number | null
        }
        Update: {
          client_id?: string
          completed_at?: string
          distance_m?: number | null
          duration_s?: number | null
          exercise_id?: string
          id?: string
          incline_pct?: number | null
          is_warmup?: boolean
          reps?: number | null
          rir?: number | null
          session_id?: string
          set_index?: number
          side?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          date: string
          ended_at: string | null
          focus: string[]
          id: string
          note: string | null
          plan_day_id: string | null
          plan_id: string | null
          session_rpe: number | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          date: string
          ended_at?: string | null
          focus?: string[]
          id?: string
          note?: string | null
          plan_day_id?: string | null
          plan_id?: string | null
          session_rpe?: number | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          date?: string
          ended_at?: string | null
          focus?: string[]
          id?: string
          note?: string | null
          plan_day_id?: string | null
          plan_id?: string | null
          session_rpe?: number | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_equipment: {
        Row: {
          attributes: Json
          equipment_id: string
          id: string
          label: string
          max_weight_kg: number | null
          user_id: string
        }
        Insert: {
          attributes?: Json
          equipment_id: string
          id?: string
          label: string
          max_weight_kg?: number | null
          user_id: string
        }
        Update: {
          attributes?: Json
          equipment_id?: string
          id?: string
          label?: string
          max_weight_kg?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_equipment_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          active_plan_id: string | null
          length_unit: string
          reminder_time: string | null
          rir_target_max: number
          rir_target_min: number
          theme: string
          timezone: string
          unit: string
          user_id: string
          vtaper_target: number
          week_start: string
          weekly_cardio_goal: number
          weekly_goal_days: number
        }
        Insert: {
          active_plan_id?: string | null
          length_unit?: string
          reminder_time?: string | null
          rir_target_max?: number
          rir_target_min?: number
          theme?: string
          timezone?: string
          unit?: string
          user_id: string
          vtaper_target?: number
          week_start?: string
          weekly_cardio_goal?: number
          weekly_goal_days?: number
        }
        Update: {
          active_plan_id?: string | null
          length_unit?: string
          reminder_time?: string | null
          rir_target_max?: number
          rir_target_min?: number
          theme?: string
          timezone?: string
          unit?: string
          user_id?: string
          vtaper_target?: number
          week_start?: string
          weekly_cardio_goal?: number
          weekly_goal_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_active_plan_fk"
            columns: ["active_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      refresh_daily_stats: {
        Args: { p_date: string; p_user: string }
        Returns: undefined
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

