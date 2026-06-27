export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string;
          date: string;
          day_status: Database["public"]["Enums"]["day_status"] | null;
          early_by_mins: number;
          employee_id: string;
          id: string;
          is_checked_in: boolean;
          is_in_field: boolean;
          is_on_break: boolean;
          late_by_mins: number;
          total_break_mins: number;
          total_work_mins: number;
          updated_at: string;
          work_mode: Database["public"]["Enums"]["work_mode"];
        };
        Insert: {
          created_at?: string;
          date: string;
          day_status?: Database["public"]["Enums"]["day_status"] | null;
          early_by_mins?: number;
          employee_id: string;
          id?: string;
          is_checked_in?: boolean;
          is_in_field?: boolean;
          is_on_break?: boolean;
          late_by_mins?: number;
          total_break_mins?: number;
          total_work_mins?: number;
          updated_at?: string;
          work_mode?: Database["public"]["Enums"]["work_mode"];
        };
        Update: {
          created_at?: string;
          date?: string;
          day_status?: Database["public"]["Enums"]["day_status"] | null;
          early_by_mins?: number;
          employee_id?: string;
          id?: string;
          is_checked_in?: boolean;
          is_in_field?: boolean;
          is_on_break?: boolean;
          late_by_mins?: number;
          total_break_mins?: number;
          total_work_mins?: number;
          updated_at?: string;
          work_mode?: Database["public"]["Enums"]["work_mode"];
        };
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_policies: {
        Row: {
          absent_threshold_minutes: number | null;
          auto_mark_absent: boolean | null;
          auto_mark_absent_after_midnight: boolean | null;
          created_at: string;
          half_day_threshold_minutes: number | null;
          id: string;
          late_deduction_enabled: boolean | null;
          late_deduction_per_incident: number | null;
          late_grace_minutes: number | null;
          late_mark_after_minutes: number | null;
          max_overtime_hours_per_day: number | null;
          max_overtime_hours_per_month: number | null;
          overtime_enabled: boolean | null;
          overtime_multiplier: number | null;
          overtime_threshold_minutes: number | null;
          standard_working_hours_per_day: number | null;
          updated_at: string;
          updated_by: string | null;
          weekly_off_days: string[] | null;
        };
        Insert: {
          absent_threshold_minutes?: number | null;
          auto_mark_absent?: boolean | null;
          auto_mark_absent_after_midnight?: boolean | null;
          created_at?: string;
          half_day_threshold_minutes?: number | null;
          id?: string;
          late_deduction_enabled?: boolean | null;
          late_deduction_per_incident?: number | null;
          late_grace_minutes?: number | null;
          late_mark_after_minutes?: number | null;
          max_overtime_hours_per_day?: number | null;
          max_overtime_hours_per_month?: number | null;
          overtime_enabled?: boolean | null;
          overtime_multiplier?: number | null;
          overtime_threshold_minutes?: number | null;
          standard_working_hours_per_day?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          weekly_off_days?: string[] | null;
        };
        Update: {
          absent_threshold_minutes?: number | null;
          auto_mark_absent?: boolean | null;
          auto_mark_absent_after_midnight?: boolean | null;
          created_at?: string;
          half_day_threshold_minutes?: number | null;
          id?: string;
          late_deduction_enabled?: boolean | null;
          late_deduction_per_incident?: number | null;
          late_grace_minutes?: number | null;
          late_mark_after_minutes?: number | null;
          max_overtime_hours_per_day?: number | null;
          max_overtime_hours_per_month?: number | null;
          overtime_enabled?: boolean | null;
          overtime_multiplier?: number | null;
          overtime_threshold_minutes?: number | null;
          standard_working_hours_per_day?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          weekly_off_days?: string[] | null;
        };
        Relationships: [];
      };
      attendance_sessions: {
        Row: {
          attendance_id: string;
          check_in: string;
          check_in_lat: number | null;
          check_in_lng: number | null;
          check_in_selfie: string | null;
          check_out: string | null;
          check_out_lat: number | null;
          check_out_lng: number | null;
          check_out_selfie: string | null;
          created_at: string;
          employee_id: string;
          id: string;
          minutes: number;
          type: Database["public"]["Enums"]["session_type"];
          work_minutes: number;
        };
        Insert: {
          attendance_id: string;
          check_in: string;
          check_in_lat?: number | null;
          check_in_lng?: number | null;
          check_in_selfie?: string | null;
          check_out?: string | null;
          check_out_lat?: number | null;
          check_out_lng?: number | null;
          check_out_selfie?: string | null;
          created_at?: string;
          employee_id: string;
          id?: string;
          minutes?: number;
          type?: Database["public"]["Enums"]["session_type"];
          work_minutes?: number;
        };
        Update: {
          attendance_id?: string;
          check_in?: string;
          check_in_lat?: number | null;
          check_in_lng?: number | null;
          check_in_selfie?: string | null;
          check_out?: string | null;
          check_out_lat?: number | null;
          check_out_lng?: number | null;
          check_out_selfie?: string | null;
          created_at?: string;
          employee_id?: string;
          id?: string;
          minutes?: number;
          type?: Database["public"]["Enums"]["session_type"];
          work_minutes?: number;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_attendance_id_fkey";
            columns: ["attendance_id"];
            isOneToOne: false;
            referencedRelation: "attendance";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_sessions_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      holidays: {
        Row: {
          created_at: string;
          created_by: string | null;
          date: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          type: Database["public"]["Enums"]["holiday_type"];
          updated_at: string;
          year: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          date: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          type?: Database["public"]["Enums"]["holiday_type"];
          updated_at?: string;
          year: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          date?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          type?: Database["public"]["Enums"]["holiday_type"];
          updated_at?: string;
          year?: number;
        };
        Relationships: [];
      };
      leaves: {
        Row: {
          created_at: string;
          employee_id: string;
          employee_name: string;
          end_date: string;
          half_day_session: string | null;
          id: string;
          is_half_day: boolean;
          leave_type: Database["public"]["Enums"]["leave_type"];
          reason: string;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          reviewed_by_name: string | null;
          start_date: string;
          status: Database["public"]["Enums"]["leave_status"];
          total_days: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          employee_id: string;
          employee_name: string;
          end_date: string;
          half_day_session?: string | null;
          id?: string;
          is_half_day?: boolean;
          leave_type: Database["public"]["Enums"]["leave_type"];
          reason: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          reviewed_by_name?: string | null;
          start_date: string;
          status?: Database["public"]["Enums"]["leave_status"];
          total_days: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          employee_id?: string;
          employee_name?: string;
          end_date?: string;
          half_day_session?: string | null;
          id?: string;
          is_half_day?: boolean;
          leave_type?: Database["public"]["Enums"]["leave_type"];
          reason?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          reviewed_by_name?: string | null;
          start_date?: string;
          status?: Database["public"]["Enums"]["leave_status"];
          total_days?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leaves_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leaves_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notices: {
        Row: {
          created_at: string;
          created_by: string;
          created_by_name: string;
          id: string;
          message: string;
          read_by: string[] | null;
          target_id: string | null;
          target_name: string | null;
          title: string;
          type: Database["public"]["Enums"]["notice_type"];
        };
        Insert: {
          created_at?: string;
          created_by: string;
          created_by_name: string;
          id?: string;
          message: string;
          read_by?: string[] | null;
          target_id?: string | null;
          target_name?: string | null;
          title: string;
          type?: Database["public"]["Enums"]["notice_type"];
        };
        Update: {
          created_at?: string;
          created_by?: string;
          created_by_name?: string;
          id?: string;
          message?: string;
          read_by?: string[] | null;
          target_id?: string | null;
          target_name?: string | null;
          title?: string;
          type?: Database["public"]["Enums"]["notice_type"];
        };
        Relationships: [
          {
            foreignKeyName: "notices_target_id_fkey";
            columns: ["target_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      office_zones: {
        Row: {
          created_at: string;
          early_grace_minutes: number | null;
          grace_minutes: number | null;
          id: string;
          latitude: number | null;
          longitude: number | null;
          name: string;
          radius_meters: number | null;
          shift_end: string | null;
          shift_start: string | null;
          updated_at: string;
          week_off_day: string | null;
        };
        Insert: {
          created_at?: string;
          early_grace_minutes?: number | null;
          grace_minutes?: number | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          radius_meters?: number | null;
          shift_end?: string | null;
          shift_start?: string | null;
          updated_at?: string;
          week_off_day?: string | null;
        };
        Update: {
          created_at?: string;
          early_grace_minutes?: number | null;
          grace_minutes?: number | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          radius_meters?: number | null;
          shift_end?: string | null;
          shift_start?: string | null;
          updated_at?: string;
          week_off_day?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          break_duration: number | null;
          breaks: Json | null;
          created_at: string;
          date_of_birth: string | null;
          department: string | null;
          email: string;
          full_name: string;
          id: string;
          is_approved: boolean;
          is_custom_shift: boolean | null;
          job_role: Database["public"]["Enums"]["job_role"] | null;
          manager_id: string | null;
          office_zone_id: string | null;
          profile_photo: string | null;
          schedule_locked: boolean | null;
          schedule_set_by: string | null;
          shift_end_time: string | null;
          shift_start_time: string | null;
          shift_type: Database["public"]["Enums"]["shift_type"] | null;
          team_name: string | null;
          updated_at: string;
          week_offs: string[] | null;
        };
        Insert: {
          break_duration?: number | null;
          breaks?: Json | null;
          created_at?: string;
          date_of_birth?: string | null;
          department?: string | null;
          email: string;
          full_name: string;
          id: string;
          is_approved?: boolean;
          is_custom_shift?: boolean | null;
          job_role?: Database["public"]["Enums"]["job_role"] | null;
          manager_id?: string | null;
          office_zone_id?: string | null;
          profile_photo?: string | null;
          schedule_locked?: boolean | null;
          schedule_set_by?: string | null;
          shift_end_time?: string | null;
          shift_start_time?: string | null;
          shift_type?: Database["public"]["Enums"]["shift_type"] | null;
          team_name?: string | null;
          updated_at?: string;
          week_offs?: string[] | null;
        };
        Update: {
          break_duration?: number | null;
          breaks?: Json | null;
          created_at?: string;
          date_of_birth?: string | null;
          department?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          is_approved?: boolean;
          is_custom_shift?: boolean | null;
          job_role?: Database["public"]["Enums"]["job_role"] | null;
          manager_id?: string | null;
          office_zone_id?: string | null;
          profile_photo?: string | null;
          schedule_locked?: boolean | null;
          schedule_set_by?: string | null;
          shift_end_time?: string | null;
          shift_start_time?: string | null;
          shift_type?: Database["public"]["Enums"]["shift_type"] | null;
          team_name?: string | null;
          updated_at?: string;
          week_offs?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey";
            columns: ["manager_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_office_zone_id_fkey";
            columns: ["office_zone_id"];
            isOneToOne: false;
            referencedRelation: "office_zones";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          assigned_by: string;
          assigned_by_name: string;
          assigned_to: string;
          assigned_to_name: string;
          completed_at: string | null;
          completion_note: string | null;
          completion_photo: string | null;
          created_at: string;
          description: string | null;
          due_date: string | null;
          id: string;
          priority: Database["public"]["Enums"]["task_priority"];
          status: Database["public"]["Enums"]["task_status"];
          team_name: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_by: string;
          assigned_by_name: string;
          assigned_to: string;
          assigned_to_name: string;
          completed_at?: string | null;
          completion_note?: string | null;
          completion_photo?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          status?: Database["public"]["Enums"]["task_status"];
          team_name?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_by?: string;
          assigned_by_name?: string;
          assigned_to?: string;
          assigned_to_name?: string;
          completed_at?: string | null;
          completion_note?: string | null;
          completion_photo?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          status?: Database["public"]["Enums"]["task_status"];
          team_name?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: { _user_id: string }; Returns: boolean };
      is_manager_or_admin: { Args: { _user_id: string }; Returns: boolean };
    };
    Enums: {
      app_role: "admin" | "manager" | "employee";
      day_status: "Early" | "On Time" | "Late" | "Absent";
      holiday_type: "national" | "regional" | "optional" | "restricted";
      job_role: "full-time" | "intern";
      leave_status: "pending" | "approved" | "rejected" | "cancelled";
      leave_type: "casual" | "sick" | "earned" | "comp_off" | "lop" | "other";
      notice_type: "general" | "warning" | "urgent";
      session_type: "work" | "break" | "field";
      shift_type: "FT_MAIN" | "FT_EARLY" | "INTERN_DAY" | "CUSTOM";
      task_priority: "low" | "medium" | "high" | "urgent";
      task_status:
        | "todo"
        | "in_progress"
        | "blocked"
        | "pending_review"
        | "completed"
        | "overdue"
        | "cancelled";
      work_mode: "Present" | "Break" | "Field" | "WFH" | "Absent";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "employee"],
      day_status: ["Early", "On Time", "Late", "Absent"],
      holiday_type: ["national", "regional", "optional", "restricted"],
      job_role: ["full-time", "intern"],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      leave_type: ["casual", "sick", "earned", "comp_off", "lop", "other"],
      notice_type: ["general", "warning", "urgent"],
      session_type: ["work", "break", "field"],
      shift_type: ["FT_MAIN", "FT_EARLY", "INTERN_DAY", "CUSTOM"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: [
        "todo",
        "in_progress",
        "blocked",
        "pending_review",
        "completed",
        "overdue",
        "cancelled",
      ],
      work_mode: ["Present", "Break", "Field", "WFH", "Absent"],
    },
  },
} as const;
