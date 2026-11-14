// Generated from the live project (nvmlawpojydnouzqilaf) with the Supabase connector, 2026-11-12.
// Regenerate after any migration. Relationships/helper generics trimmed to what the app uses.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type E = Database['public']['Enums'];

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.18' };
  public: {
    Tables: {
      notifications: {
        Row: {
          id: number; recipient: string;
          kind: 'request' | 'request_decision' | 'payment' | 'account' | 'message' | 'receipt' | 'fees' | 'account_decision'
            | 'announcement' | 'members' | 'semester' | 'fee_change' | 'app_update';
          title: string; body: string | null; link: string | null; group_key: string | null; count: number;
          amount: number | null; created_at: string; updated_at: string; read_at: string | null;
        };
        Insert: never;
        Update: { read_at?: string | null };
        Relationships: [];
      };
      courses: {
        Row: { code: string; name: string; sort: number };
        Insert: { code: string; name: string; sort?: number };
        Update: { code?: string; name?: string; sort?: number };
        Relationships: [];
      };
      course_orgs: {
        Row: { course: string; entity_id: number };
        Insert: { course: string; entity_id: number };
        Update: { course?: string; entity_id?: number };
        Relationships: [];
      };
      audit_log: {
        Row: { id: number; table_name: string; action: string; row_pk: string | null; before_row: Json | null; after_row: Json | null; actor: string | null; at: string };
        Insert: never; Update: never; Relationships: [];
      };
      accredited_entries: {
        Row: {
          academic_year: string | null; accredited_on: string | null; adviser: string | null;
          category: E['entity_category']; created_at: string; entity_id: number | null;
          expires_on: string | null; id: number; name: string; remarks: string | null;
          status: E['accreditation_status'];
        };
        Insert: {
          academic_year?: string | null; accredited_on?: string | null; adviser?: string | null;
          category: E['entity_category']; entity_id?: number | null; expires_on?: string | null;
          name: string; remarks?: string | null; status?: E['accreditation_status'];
        };
        Update: {
          academic_year?: string | null; accredited_on?: string | null; adviser?: string | null;
          category?: E['entity_category']; entity_id?: number | null; expires_on?: string | null;
          name?: string; remarks?: string | null; status?: E['accreditation_status'];
        };
        Relationships: [];
      };
      accredited_history: {
        Row: {
          action: string; after_row: Json | null; before_row: Json | null; changed_at: string;
          changed_by: string | null; entry_id: number; id: number;
        };
        Insert: never; Update: never; Relationships: [];
      };
      broadcast_reads: {
        Row: { message_id: number; profile_id: string; read_at: string };
        Insert: never; Update: never; Relationships: [];
      };
      entities: {
        Row: {
          category: E['entity_category']; created_at: string; dues_amount: number; dues_period: E['dues_period'];
          id: number; is_active: boolean; is_school_wide: boolean; logo_path: string | null; name: string; short_name: string;
        };
        Insert: {
          category: E['entity_category']; dues_amount?: number; dues_period?: E['dues_period']; is_active?: boolean;
          is_school_wide?: boolean; logo_path?: string | null; name: string; short_name: string;
        };
        Update: {
          category?: E['entity_category']; dues_amount?: number; dues_period?: E['dues_period']; is_active?: boolean;
          is_school_wide?: boolean; logo_path?: string | null; name?: string; short_name?: string;
        };
        Relationships: [];
      };
      fund_requests: {
        Row: {
          amount: number; attachment_path: string | null; description: string; entity_id: number; filed_at: string;
          filed_by: string | null; id: number; kind: E['request_kind']; remarks: string | null; reviewed_at: string | null;
          reviewed_by: string | null; school_year_id: number; status: E['request_status'];
          category: E['expense_category'] | null;
        };
        Insert: never; Update: never; Relationships: [];
      };
      ledger_entries: {
        Row: {
          amount: number; attachment_path: string | null; created_at: string; created_by: string | null; description: string;
          direction: number | null; entity_id: number; id: number; kind: E['ledger_kind']; membership_id: number | null;
          occurred_on: string; pocket: E['pocket'] | null; request_id: number | null; reverses_id: number | null;
          school_year_id: number; semester_id: number | null; category: E['expense_category'] | null;
        };
        Insert: never; Update: never; Relationships: [];
      };
      memberships: {
        Row: {
          amount_due: number; collection_entry_id: number | null; created_at: string; entity_id: number; id: number;
          is_paid: boolean; paid_at: string | null; recorded_by: string | null; school_year_id: number;
          semester_id: number | null; student_id: number; via_course: boolean; carried_over: boolean;
        };
        Insert: { amount_due: number; entity_id: number; school_year_id: number; semester_id?: number | null; student_id: number };
        Update: { amount_due?: number };
        Relationships: [
          { foreignKeyName: 'memberships_student_id_fkey'; columns: ['student_id']; isOneToOne: false; referencedRelation: 'students'; referencedColumns: ['id'] },
          { foreignKeyName: 'memberships_entity_id_fkey'; columns: ['entity_id']; isOneToOne: false; referencedRelation: 'entities'; referencedColumns: ['id'] },
        ];
      };
      receipts: {
        Row: {
          id: number; receipt_no: string; membership_id: number; student_id: number; entity_id: number; school_year_id: number;
          semester_id: number | null; amount: number; issued_at: string; issued_by: string | null; voided_at: string | null; void_reason: string | null;
        };
        Insert: never; Update: never;
        Relationships: [
          { foreignKeyName: 'receipts_student_id_fkey'; columns: ['student_id']; isOneToOne: false; referencedRelation: 'students'; referencedColumns: ['id'] },
          { foreignKeyName: 'receipts_entity_id_fkey'; columns: ['entity_id']; isOneToOne: false; referencedRelation: 'entities'; referencedColumns: ['id'] },
          { foreignKeyName: 'receipts_school_year_id_fkey'; columns: ['school_year_id']; isOneToOne: false; referencedRelation: 'school_years'; referencedColumns: ['id'] },
          { foreignKeyName: 'receipts_semester_id_fkey'; columns: ['semester_id']; isOneToOne: false; referencedRelation: 'semesters'; referencedColumns: ['id'] },
        ];
      };
      messages: {
        Row: { body: string; created_at: string; entity_id: number | null; id: number; read_at: string | null; sender_id: string };
        Insert: { body: string; entity_id?: number | null; sender_id: string };
        Update: never; Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string; email: string | null; entity_id: number | null; full_name: string | null; id: string;
          requested_entity_id: number | null; requested_role: E['app_role'] | null; requested_student_no: string | null;
          review_remarks: string | null; reviewed_at: string | null; reviewed_by: string | null; role: E['app_role'] | null;
          status: E['account_status']; student_id: number | null; terms_accepted_at: string | null;
        };
        Insert: never; Update: never; Relationships: [];
      };
      school_years: {
        Row: { created_at: string; ends_on: string; id: number; is_current: boolean; label: string; starts_on: string };
        Insert: { ends_on: string; is_current?: boolean; label: string; starts_on: string };
        Update: { ends_on?: string; is_current?: boolean; label?: string; starts_on?: string };
        Relationships: [];
      };
      semesters: {
        Row: { ends_on: string; id: number; is_current: boolean; school_year_id: number; starts_on: string; term: number };
        Insert: { ends_on: string; is_current?: boolean; school_year_id: number; starts_on: string; term: number };
        Update: { ends_on?: string; is_current?: boolean; starts_on?: string };
        Relationships: [];
      };
      students: {
        Row: {
          course: string | null; created_at: string; email: string | null; full_name: string; id: number;
          is_active: boolean; student_no: string; year_level: number | null;
        };
        Insert: { course?: string | null; email?: string | null; full_name: string; is_active?: boolean; student_no: string; year_level?: number | null };
        Update: { course?: string | null; email?: string | null; full_name?: string; is_active?: boolean; student_no?: string; year_level?: number | null };
        Relationships: [];
      };
      year_closures: {
        Row: { closed_at: string; closed_by: string | null; closing_total: number; entity_id: number; school_year_id: number };
        Insert: never; Update: never; Relationships: [];
      };
    };
    Views: {
      accredited_list: {
        Row: {
          academic_year: string | null; accredited_on: string | null; adviser: string | null; category: E['entity_category'] | null;
          created_at: string | null; effective_status: string | null; entity_id: number | null; expires_on: string | null;
          id: number | null; name: string | null; remarks: string | null; status: E['accreditation_status'] | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      add_member: {
        Args: { p_student_no: string; p_full_name: string; p_course: string | null; p_year_level?: number | null };
        Returns: {
          student_id: number; new_student: boolean; member_of: string[] | null; course: string | null;
          paid_amount: number; to_collect: string[]; membership_id: number | null; amount_due: number;
        };
      };
      save_push_token: { Args: { p_token: string; p_platform?: string }; Returns: undefined };
      drop_push_token: { Args: { p_token: string }; Returns: undefined };
      announce: { Args: { p_audience: 'students' | 'treasurers' | 'everyone'; p_title: string; p_body: string }; Returns: number };
      note_app_updated: { Args: { p_build: string }; Returns: undefined };
      mark_notifications_read: { Args: Record<string, never>; Returns: number };
      accept_terms: { Args: Record<string, never>; Returns: string };
      admin_adjust: { Args: { p_amount: number; p_direction: number; p_entity_id: number; p_pocket: E['pocket']; p_reason: string }; Returns: number };
      admin_release: { Args: { p_amount: number; p_description: string; p_entity_id: number }; Returns: number };
      cancel_request: { Args: { p_request_id: number }; Returns: undefined };
      close_school_year: { Args: { p_entity_id: number; p_school_year_id: number }; Returns: number };
      disable_account: { Args: { p_profile_id: string; p_remarks?: string }; Returns: undefined };
      enable_account: { Args: { p_profile_id: string; p_remarks?: string }; Returns: undefined };
      import_students: { Args: { p_rows: Json }; Returns: Json };
      file_request: {
        Args: { p_amount: number; p_attachment_path?: string; p_description: string; p_entity_id: number; p_kind: E['request_kind']; p_category?: E['expense_category'] };
        Returns: number;
      };
      get_entity_report: { Args: { p_school_year_id: number; p_semester_id?: number }; Returns: EntityReport[] };
      get_school_summary: { Args: { p_school_year_id: number }; Returns: SchoolSummary[] };
      get_entity_finance: { Args: { p_entity_id: number; p_school_year_id: number }; Returns: Finance };
      get_school_finance: { Args: { p_school_year_id: number }; Returns: Finance };
      mark_thread_read: { Args: { p_entity_id: number }; Returns: number };
      mark_broadcasts_read: { Args: Record<string, never>; Returns: number };
      record_payment: { Args: { p_membership_id: number }; Returns: number };
      reverse_entry: { Args: { p_entry_id: number; p_reason: string }; Returns: number };
      review_account: {
        Args: {
          p_approve: boolean; p_entity_id?: number; p_profile_id: string; p_remarks?: string;
          p_role?: E['app_role']; p_student_id?: number;
        };
        Returns: undefined;
      };
      review_request: { Args: { p_approve: boolean; p_remarks?: string; p_request_id: number; p_category?: E['expense_category'] }; Returns: number };
      // Server-function only (service_role); the browser cannot call these two.
      student_login_lookup: { Args: { p_student_no: string }; Returns: { email: string | null; locked_until: string | null }[] };
      student_login_record: { Args: { p_student_no: string; p_ok: boolean }; Returns: undefined };
      set_my_request: {
        Args: { p_role: E['app_role']; p_entity_id?: number; p_student_no?: string; p_full_name?: string };
        Returns: undefined;
      };
      set_entity_dues: { Args: { p_amount: number; p_entity_id: number; p_period: E['dues_period'] }; Returns: undefined };
      undo_payment: { Args: { p_membership_id: number; p_reason: string }; Returns: number };
    };
    Enums: {
      account_status: 'pending' | 'approved' | 'rejected' | 'disabled';
      accreditation_status: 'accredited' | 'pending' | 'revoked';
      app_role: 'admin' | 'treasurer' | 'student';
      dues_period: 'school_year' | 'semester';
      entity_category: 'organization' | 'club';
      ledger_kind: 'opening' | 'collection' | 'remittance' | 'release' | 'expense' | 'adjustment' | 'reversal';
      pocket: 'cash' | 'saved';
      request_kind: 'remittance' | 'release' | 'expense';
      request_status: 'pending' | 'approved' | 'rejected' | 'cancelled';
      expense_category: 'events' | 'supplies' | 'food' | 'transport' | 'printing' | 'outreach' | 'other';
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type EntityReport = {
  adjustments: number; available_to_release: number; available_to_remit: number; cash_on_hand: number;
  category: E['entity_category']; collections: number; entity_id: number; expenses: number; is_closed: boolean;
  is_school_wide: boolean; members: number; name: string; openings: number; paid_members: number;
  pending_expenses: number; pending_releases: number; pending_remittances: number; previous_funds: number;
  releases: number; remittances: number; saved_with_sas: number; short_name: string; total_fund: number;
};
/** get_entity_finance / get_school_finance (migration 27). `receipt_checked` only reaches SAS + that org's treasurer. */
export type Finance = {
  money_in: number; money_out: number;
  monthly: { month: string; money_in: number; money_out: number }[];
  categories: { category: E['expense_category']; amount: number }[];
  expenses: { date: string; description: string; category: E['expense_category']; amount: number; receipt_checked?: boolean }[] | null;
};
export type SchoolSummary = {
  cash_on_hand: number; clubs: number; expenses: number; organizations: number; pending_requests: number;
  saved_with_sas: number; students: number; total_fund: number;
};

type T = Database['public']['Tables'];
export type Row<K extends keyof T> = T[K]['Row'];
export type Enum<K extends keyof Database['public']['Enums']> = Database['public']['Enums'][K];
