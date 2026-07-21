export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          id: string
          module: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          id?: string
          module: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          id?: string
          module?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      daily_marks: {
        Row: {
          created_at: string
          date: string
          id: string
          max_score: number
          notes: string | null
          recorded_by: string | null
          score: number
          student_id: string
          subject: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          max_score?: number
          notes?: string | null
          recorded_by?: string | null
          score: number
          student_id: string
          subject: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          max_score?: number
          notes?: string | null
          recorded_by?: string | null
          score?: number
          student_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          entry_date: string
          id: string
          recorded_by: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          recorded_by?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          recorded_by?: string | null
        }
        Relationships: []
      }
      grades: {
        Row: {
          id: number
          is_active: boolean
          name_ar: string
        }
        Insert: {
          id: number
          is_active?: boolean
          name_ar: string
        }
        Update: {
          id?: number
          is_active?: boolean
          name_ar?: string
        }
        Relationships: []
      }
      income_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          entry_date: string
          id: string
          recorded_by: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          recorded_by?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          recorded_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sections: {
        Row: {
          created_at: string
          grade_id: number
          id: string
          is_active: boolean
          section_number: number
        }
        Insert: {
          created_at?: string
          grade_id: number
          id?: string
          is_active?: boolean
          section_number: number
        }
        Update: {
          created_at?: string
          grade_id?: number
          id?: string
          is_active?: boolean
          section_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "sections_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
        ]
      }
      student_documents: {
        Row: {
          created_at: string
          document_type: string | null
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          student_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type?: string | null
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          student_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string | null
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          student_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_payment_plans: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          due_date: string
          id: string
          installment_number: number
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          installment_number: number
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          installment_number?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_payment_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string | null
          notes: string | null
          payment_date: string
          recorded_by: string | null
          reference: string | null
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          recorded_by?: string | null
          reference?: string | null
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          recorded_by?: string | null
          reference?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          birth_date: string | null
          created_at: string
          enrollment_date: string
          full_name: string
          gender: string | null
          grade_id: number
          guardian_name: string | null
          guardian_phone: string | null
          guardian_relation: string | null
          id: string
          is_active: boolean
          notes: string | null
          section_id: string
          student_number: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          created_at?: string
          enrollment_date?: string
          full_name: string
          gender?: string | null
          grade_id: number
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relation?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          section_id: string
          student_number: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          created_at?: string
          enrollment_date?: string
          full_name?: string
          gender?: string | null
          grade_id?: number
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relation?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          section_id?: string
          student_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          id: string
          recorded_by: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          id?: string
          recorded_by?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          id?: string
          recorded_by?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          period_from: string | null
          period_to: string | null
          recorded_by: string | null
          teacher_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          period_from?: string | null
          period_to?: string | null
          recorded_by?: string | null
          teacher_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          period_from?: string | null
          period_to?: string | null
          recorded_by?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_payments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_section_assignments: {
        Row: {
          created_at: string
          id: string
          section_id: string
          subject: string | null
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          section_id: string
          subject?: string | null
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          section_id?: string
          subject?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_section_assignments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_section_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          attendance_code: string | null
          created_at: string
          due_override: number | null
          email: string | null
          full_name: string
          hire_date: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          salary_amount: number
          salary_type: Database["public"]["Enums"]["salary_type"]
          subjects: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attendance_code?: string | null
          created_at?: string
          due_override?: number | null
          email?: string | null
          full_name: string
          hire_date?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          salary_amount?: number
          salary_type?: Database["public"]["Enums"]["salary_type"]
          subjects?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attendance_code?: string | null
          created_at?: string
          due_override?: number | null
          email?: string | null
          full_name?: string
          hire_date?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          salary_amount?: number
          salary_type?: Database["public"]["Enums"]["salary_type"]
          subjects?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      worker_attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          worker_id: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          worker_id: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_attendance_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          period_from: string | null
          period_to: string | null
          recorded_by: string | null
          worker_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          period_from?: string | null
          period_to?: string | null
          recorded_by?: string | null
          worker_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          period_from?: string | null
          period_to?: string | null
          recorded_by?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_payments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          attendance_code: string | null
          created_at: string
          full_name: string
          hire_date: string
          id: string
          is_active: boolean
          job_title: string | null
          notes: string | null
          phone: string | null
          salary_amount: number
          updated_at: string
        }
        Insert: {
          attendance_code?: string | null
          created_at?: string
          full_name: string
          hire_date?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          salary_amount?: number
          updated_at?: string
        }
        Update: {
          attendance_code?: string | null
          created_at?: string
          full_name?: string
          hire_date?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          salary_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "accountant" | "reception" | "teacher"
      attendance_status: "present" | "absent" | "late"
      salary_type: "fixed" | "hourly"
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
    Enums: {
      app_role: ["admin", "accountant", "reception", "teacher"],
      attendance_status: ["present", "absent", "late"],
      salary_type: ["fixed", "hourly"],
    },
  },
} as const
