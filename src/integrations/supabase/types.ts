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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata_json: Json | null
          organization_id: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata_json?: Json | null
          organization_id?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata_json?: Json | null
          organization_id?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          bank_account_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          extraction_confidence_score: number | null
          file_url: string | null
          id: string
          needs_review: boolean
          project_execution_id: string
          statement_period_end: string | null
          statement_period_start: string | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          bank_account_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          extraction_confidence_score?: number | null
          file_url?: string | null
          id?: string
          needs_review?: boolean
          project_execution_id: string
          statement_period_end?: string | null
          statement_period_start?: string | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          bank_account_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          extraction_confidence_score?: number | null
          file_url?: string | null
          id?: string
          needs_review?: boolean
          project_execution_id?: string
          statement_period_end?: string | null
          statement_period_start?: string | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "project_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_project_execution_id_fkey"
            columns: ["project_execution_id"]
            isOneToOne: false
            referencedRelation: "project_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          bank_account_id: string
          bank_statement_id: string
          created_at: string
          description_raw: string
          direction: string
          document_id_reference: string | null
          id: string
          parsed_json: Json | null
          posting_date: string | null
          transaction_date: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          bank_account_id: string
          bank_statement_id: string
          created_at?: string
          description_raw: string
          direction?: string
          document_id_reference?: string | null
          id?: string
          parsed_json?: Json | null
          posting_date?: string | null
          transaction_date: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          bank_account_id?: string
          bank_statement_id?: string
          created_at?: string
          description_raw?: string
          direction?: string
          document_id_reference?: string | null
          id?: string
          parsed_json?: Json | null
          posting_date?: string | null
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "project_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_bank_statement_id_fkey"
            columns: ["bank_statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      cnpq_areas: {
        Row: {
          code: string
          full_path: string
          level: number
          name: string
          parent_code: string | null
        }
        Insert: {
          code: string
          full_path: string
          level: number
          name: string
          parent_code?: string | null
        }
        Update: {
          code?: string
          full_path?: string
          level?: number
          name?: string
          parent_code?: string | null
        }
        Relationships: []
      }
      editais: {
        Row: {
          blind_code_prefix: string | null
          blind_code_strategy: string
          blind_review_enabled: boolean
          cancellation_reason: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          end_date: string | null
          form_id: string | null
          id: string
          is_public: boolean
          min_reviewers_per_proposal: number | null
          organization_id: string
          published_at: string | null
          review_deadline: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["edital_status"]
          title: string
          updated_at: string
        }
        Insert: {
          blind_code_prefix?: string | null
          blind_code_strategy?: string
          blind_review_enabled?: boolean
          cancellation_reason?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          form_id?: string | null
          id?: string
          is_public?: boolean
          min_reviewers_per_proposal?: number | null
          organization_id: string
          published_at?: string | null
          review_deadline?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["edital_status"]
          title: string
          updated_at?: string
        }
        Update: {
          blind_code_prefix?: string | null
          blind_code_strategy?: string
          blind_review_enabled?: boolean
          cancellation_reason?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          form_id?: string | null
          id?: string
          is_public?: boolean
          min_reviewers_per_proposal?: number | null
          organization_id?: string
          published_at?: string | null
          review_deadline?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["edital_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "editais_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editais_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_areas: {
        Row: {
          edital_id: string
          id: string
          knowledge_area_id: string
        }
        Insert: {
          edital_id: string
          id?: string
          knowledge_area_id: string
        }
        Update: {
          edital_id?: string
          id?: string
          knowledge_area_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edital_areas_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edital_areas_knowledge_area_id_fkey"
            columns: ["knowledge_area_id"]
            isOneToOne: false
            referencedRelation: "knowledge_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_form_schemas: {
        Row: {
          created_at: string
          edital_id: string
          id: string
          is_active: boolean
          schema_json: Json
          version: number
        }
        Insert: {
          created_at?: string
          edital_id: string
          id?: string
          is_active?: boolean
          schema_json?: Json
          version?: number
        }
        Update: {
          created_at?: string
          edital_id?: string
          id?: string
          is_active?: boolean
          schema_json?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "edital_form_schemas_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_forms: {
        Row: {
          created_at: string
          edital_id: string
          id: string
          knowledge_area_mode: string
          knowledge_area_required: boolean
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          edital_id: string
          id?: string
          knowledge_area_mode?: string
          knowledge_area_required?: boolean
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          edital_id?: string
          id?: string
          knowledge_area_mode?: string
          knowledge_area_required?: boolean
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edital_forms_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: true
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edital_forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_submission_drafts: {
        Row: {
          answers: Json
          cnpq_area_code: string | null
          created_at: string
          edital_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          cnpq_area_code?: string | null
          created_at?: string
          edital_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          cnpq_area_code?: string | null
          created_at?: string
          edital_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edital_submission_drafts_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_submission_files: {
        Row: {
          created_at: string
          file_type: string
          file_url: string
          id: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          file_type?: string
          file_url: string
          id?: string
          submission_id: string
        }
        Update: {
          created_at?: string
          file_type?: string
          file_url?: string
          id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edital_submission_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "edital_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_submissions: {
        Row: {
          answers: Json
          cnpq_area_code: string | null
          created_at: string
          edital_id: string
          form_version_id: string | null
          id: string
          protocol: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          cnpq_area_code?: string | null
          created_at?: string
          edital_id: string
          form_version_id?: string | null
          id?: string
          protocol?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          cnpq_area_code?: string | null
          created_at?: string
          edital_id?: string
          form_version_id?: string | null
          id?: string
          protocol?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edital_submissions_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edital_submissions_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_payments: {
        Row: {
          bank_transaction_id: string
          created_at: string
          expense_id: string
          id: string
          paid_amount: number
          paid_date: string
        }
        Insert: {
          bank_transaction_id: string
          created_at?: string
          expense_id: string
          id?: string
          paid_amount: number
          paid_date: string
        }
        Update: {
          bank_transaction_id?: string
          created_at?: string
          expense_id?: string
          id?: string
          paid_amount?: number
          paid_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_payments_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "project_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          created_at: string
          field_type: Database["public"]["Enums"]["field_type"]
          form_id: string
          help_text: string | null
          id: string
          is_required: boolean
          label: string
          max_chars: number | null
          min_chars: number | null
          options: Json | null
          section_description: string | null
          section_title: string | null
          sort_order: number
          updated_at: string
          validation_rules: Json | null
        }
        Insert: {
          created_at?: string
          field_type?: Database["public"]["Enums"]["field_type"]
          form_id: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          label: string
          max_chars?: number | null
          min_chars?: number | null
          options?: Json | null
          section_description?: string | null
          section_title?: string | null
          sort_order?: number
          updated_at?: string
          validation_rules?: Json | null
        }
        Update: {
          created_at?: string
          field_type?: Database["public"]["Enums"]["field_type"]
          form_id?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          label?: string
          max_chars?: number | null
          min_chars?: number | null
          options?: Json | null
          section_description?: string | null
          section_title?: string | null
          sort_order?: number
          updated_at?: string
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_knowledge_areas: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          form_id: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          form_id: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          form_id?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_knowledge_areas_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "edital_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_question_options: {
        Row: {
          created_at: string
          id: string
          label: string
          question_id: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          question_id: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          question_id?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "form_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_questions: {
        Row: {
          created_at: string
          form_id: string
          help_text: string | null
          id: string
          is_required: boolean
          label: string
          options: Json | null
          options_source: string | null
          section: string
          section_id: string | null
          sort_order: number
          type: string
          updated_at: string
          validation_rules: Json | null
        }
        Insert: {
          created_at?: string
          form_id: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          label: string
          options?: Json | null
          options_source?: string | null
          section?: string
          section_id?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
          validation_rules?: Json | null
        }
        Update: {
          created_at?: string
          form_id?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          label?: string
          options?: Json | null
          options_source?: string | null
          section?: string
          section_id?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "form_questions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "edital_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "form_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      form_response_drafts: {
        Row: {
          created_at: string
          data: Json
          edital_id: string
          form_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          edital_id: string
          form_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          edital_id?: string
          form_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_response_drafts_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_response_drafts_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "edital_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_sections: {
        Row: {
          created_at: string
          description: string | null
          form_id: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          form_id: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          form_id?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_sections_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "edital_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_versions: {
        Row: {
          created_at: string
          created_by: string | null
          form_id: string
          id: string
          snapshot: Json
          status: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          form_id: string
          id?: string
          snapshot: Json
          status?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          form_id?: string
          id?: string
          snapshot?: Json
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "edital_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          code: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          status: Database["public"]["Enums"]["form_status"]
          updated_at: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          status?: Database["public"]["Enums"]["form_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["form_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_reveals: {
        Row: {
          edital_id: string
          id: string
          proposal_id: string
          reason: string
          revealed_at: string
          revealed_by: string
        }
        Insert: {
          edital_id: string
          id?: string
          proposal_id: string
          reason: string
          revealed_at?: string
          revealed_by: string
        }
        Update: {
          edital_id?: string
          id?: string
          proposal_id?: string
          reason?: string
          revealed_at?: string
          revealed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_reveals_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_reveals_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_reveals_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "submissions_blind"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      institutions: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          municipio: string | null
          name: string
          organization_type: string | null
          sigla: string | null
          source: string
          uf: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          municipio?: string | null
          name: string
          organization_type?: string | null
          sigla?: string | null
          source?: string
          uf?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          municipio?: string | null
          name?: string
          organization_type?: string | null
          sigla?: string | null
          source?: string
          uf?: string | null
        }
        Relationships: []
      }
      knowledge_areas: {
        Row: {
          code: string | null
          created_at: string
          edital_id: string | null
          id: string
          is_active: boolean
          level: number
          name: string
          organization_id: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          edital_id?: string | null
          id?: string
          is_active?: boolean
          level?: number
          name: string
          organization_id: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          edital_id?: string | null
          id?: string
          is_active?: boolean
          level?: number
          name?: string
          organization_id?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_areas_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_areas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_areas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "knowledge_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_country: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zipcode: string | null
          cpf: string | null
          cpf_hash: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          instagram_url: string | null
          institution_affiliation: string | null
          institution_custom_name: string | null
          institution_id: string | null
          institution_type: string | null
          keywords: string[] | null
          lattes_url: string | null
          linkedin_url: string | null
          mini_bio: string | null
          phone: string | null
          photo_url: string | null
          professional_position: string | null
          profile_completed: boolean | null
          profile_completed_at: string | null
          receive_editais_notifications: boolean | null
          receive_news: boolean | null
          research_area_cnpq: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          cpf?: string | null
          cpf_hash?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          instagram_url?: string | null
          institution_affiliation?: string | null
          institution_custom_name?: string | null
          institution_id?: string | null
          institution_type?: string | null
          keywords?: string[] | null
          lattes_url?: string | null
          linkedin_url?: string | null
          mini_bio?: string | null
          phone?: string | null
          photo_url?: string | null
          professional_position?: string | null
          profile_completed?: boolean | null
          profile_completed_at?: string | null
          receive_editais_notifications?: boolean | null
          receive_news?: boolean | null
          research_area_cnpq?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          cpf?: string | null
          cpf_hash?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          instagram_url?: string | null
          institution_affiliation?: string | null
          institution_custom_name?: string | null
          institution_id?: string | null
          institution_type?: string | null
          keywords?: string[] | null
          lattes_url?: string | null
          linkedin_url?: string | null
          mini_bio?: string | null
          phone?: string | null
          photo_url?: string | null
          professional_position?: string | null
          profile_completed?: boolean | null
          profile_completed_at?: string | null
          receive_editais_notifications?: boolean | null
          receive_news?: boolean | null
          research_area_cnpq?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_bank_accounts: {
        Row: {
          account_holder_document: string
          account_holder_name: string
          account_number: string
          account_type: string
          bank_code: string | null
          bank_name: string
          branch_number: string
          created_at: string
          id: string
          project_execution_id: string
          updated_at: string
        }
        Insert: {
          account_holder_document: string
          account_holder_name: string
          account_number: string
          account_type?: string
          bank_code?: string | null
          bank_name: string
          branch_number: string
          created_at?: string
          id?: string
          project_execution_id: string
          updated_at?: string
        }
        Update: {
          account_holder_document?: string
          account_holder_name?: string
          account_number?: string
          account_type?: string
          bank_code?: string | null
          bank_name?: string
          branch_number?: string
          created_at?: string
          id?: string
          project_execution_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_bank_accounts_project_execution_id_fkey"
            columns: ["project_execution_id"]
            isOneToOne: false
            referencedRelation: "project_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_executions: {
        Row: {
          created_at: string
          created_by: string
          edital_id: string
          end_date: string | null
          id: string
          organization_id: string
          proposal_id: string
          start_date: string | null
          status: string
          title: string | null
          total_budget: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          edital_id: string
          end_date?: string | null
          id?: string
          organization_id: string
          proposal_id: string
          start_date?: string | null
          status?: string
          title?: string | null
          total_budget?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          edital_id?: string
          end_date?: string | null
          id?: string
          organization_id?: string
          proposal_id?: string
          start_date?: string | null
          status?: string
          title?: string | null
          total_budget?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_executions_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_executions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_executions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "submissions_blind"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      project_expenses: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          invoice_number: string | null
          issue_date: string | null
          notes: string | null
          project_execution_id: string
          status: string
          supplier_document: string | null
          supplier_name: string | null
          total_value: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          notes?: string | null
          project_execution_id: string
          status?: string
          supplier_document?: string | null
          supplier_name?: string | null
          total_value?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          notes?: string | null
          project_execution_id?: string
          status?: string
          supplier_document?: string | null
          supplier_name?: string | null
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_expenses_project_execution_id_fkey"
            columns: ["project_execution_id"]
            isOneToOne: false
            referencedRelation: "project_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_refunds: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string
          id: string
          project_execution_id: string
          reason: string | null
          refund_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by: string
          description: string
          id?: string
          project_execution_id: string
          reason?: string | null
          refund_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          project_execution_id?: string
          reason?: string | null
          refund_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_refunds_project_execution_id_fkey"
            columns: ["project_execution_id"]
            isOneToOne: false
            referencedRelation: "project_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_answers: {
        Row: {
          answers_json: Json
          id: string
          proposal_id: string
          updated_at: string
        }
        Insert: {
          answers_json?: Json
          id?: string
          proposal_id: string
          updated_at?: string
        }
        Update: {
          answers_json?: Json
          id?: string
          proposal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_answers_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_answers_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "submissions_blind"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      proposal_decisions: {
        Row: {
          decided_at: string
          decided_by: string
          decision: string
          id: string
          justification: string | null
          proposal_id: string
        }
        Insert: {
          decided_at?: string
          decided_by: string
          decision: string
          id?: string
          justification?: string | null
          proposal_id: string
        }
        Update: {
          decided_at?: string
          decided_by?: string
          decision?: string
          id?: string
          justification?: string | null
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_decisions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_decisions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "submissions_blind"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      proposal_files: {
        Row: {
          file_path: string
          file_type: string | null
          id: string
          proposal_id: string
          uploaded_at: string
        }
        Insert: {
          file_path: string
          file_type?: string | null
          id?: string
          proposal_id: string
          uploaded_at?: string
        }
        Update: {
          file_path?: string
          file_type?: string | null
          id?: string
          proposal_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_files_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_files_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "submissions_blind"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      proposal_reviewer_conflicts: {
        Row: {
          created_at: string
          edital_id: string
          id: string
          org_id: string
          proposal_id: string
          reason: string | null
          reviewer_user_id: string
        }
        Insert: {
          created_at?: string
          edital_id: string
          id?: string
          org_id: string
          proposal_id: string
          reason?: string | null
          reviewer_user_id: string
        }
        Update: {
          created_at?: string
          edital_id?: string
          id?: string
          org_id?: string
          proposal_id?: string
          reason?: string | null
          reviewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_reviewer_conflicts_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_reviewer_conflicts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_reviewer_conflicts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_reviewer_conflicts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "submissions_blind"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      proposals: {
        Row: {
          blind_code: string | null
          blind_code_generated_at: string | null
          created_at: string
          edital_id: string
          id: string
          knowledge_area_id: string | null
          organization_id: string
          proponente_user_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          submitted_at: string | null
        }
        Insert: {
          blind_code?: string | null
          blind_code_generated_at?: string | null
          created_at?: string
          edital_id: string
          id?: string
          knowledge_area_id?: string | null
          organization_id: string
          proponente_user_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          submitted_at?: string | null
        }
        Update: {
          blind_code?: string | null
          blind_code_generated_at?: string | null
          created_at?: string
          edital_id?: string
          id?: string
          knowledge_area_id?: string | null
          organization_id?: string
          proponente_user_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_knowledge_area_id_fkey"
            columns: ["knowledge_area_id"]
            isOneToOne: false
            referencedRelation: "knowledge_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliations: {
        Row: {
          bank_transaction_id: string
          decided_at: string | null
          decided_by: string | null
          expense_id: string | null
          id: string
          match_rule: string | null
          notes: string | null
          project_execution_id: string
          refund_id: string | null
          status: string
        }
        Insert: {
          bank_transaction_id: string
          decided_at?: string | null
          decided_by?: string | null
          expense_id?: string | null
          id?: string
          match_rule?: string | null
          notes?: string | null
          project_execution_id: string
          refund_id?: string | null
          status?: string
        }
        Update: {
          bank_transaction_id?: string
          decided_at?: string | null
          decided_by?: string | null
          expense_id?: string | null
          id?: string
          match_rule?: string | null
          notes?: string | null
          project_execution_id?: string
          refund_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliations_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "project_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_project_execution_id_fkey"
            columns: ["project_execution_id"]
            isOneToOne: false
            referencedRelation: "project_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "project_refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      review_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          conflict_declared: boolean
          conflict_reason: string | null
          id: string
          proposal_id: string
          reviewer_user_id: string
          status: string
          submitted_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          conflict_declared?: boolean
          conflict_reason?: string | null
          id?: string
          proposal_id: string
          reviewer_user_id: string
          status?: string
          submitted_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          conflict_declared?: boolean
          conflict_reason?: string | null
          id?: string
          proposal_id?: string
          reviewer_user_id?: string
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_assignments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_assignments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "submissions_blind"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      review_scores: {
        Row: {
          comment: string | null
          criteria_id: string
          id: string
          review_id: string
          score: number
        }
        Insert: {
          comment?: string | null
          criteria_id: string
          id?: string
          review_id: string
          score: number
        }
        Update: {
          comment?: string | null
          criteria_id?: string
          id?: string
          review_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_scores_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "scoring_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_conflicts: {
        Row: {
          conflict_type: string
          declared_at: string
          declared_by: string | null
          description: string | null
          id: string
          org_id: string
          reviewer_id: string
          user_id: string | null
        }
        Insert: {
          conflict_type?: string
          declared_at?: string
          declared_by?: string | null
          description?: string | null
          id?: string
          org_id: string
          reviewer_id: string
          user_id?: string | null
        }
        Update: {
          conflict_type?: string
          declared_at?: string
          declared_by?: string | null
          description?: string | null
          id?: string
          org_id?: string
          reviewer_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_conflicts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_conflicts_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "reviewers"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_invites: {
        Row: {
          areas: Json | null
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          institution: string | null
          institution_custom_name: string | null
          institution_id: string | null
          institution_type: string | null
          invite_code: string | null
          keywords: string[] | null
          lattes_url: string | null
          orcid: string | null
          org_id: string
          reviewer_id: string | null
          token_hash: string | null
          used_at: string | null
        }
        Insert: {
          areas?: Json | null
          created_at?: string
          email: string
          expires_at: string
          full_name?: string | null
          id?: string
          institution?: string | null
          institution_custom_name?: string | null
          institution_id?: string | null
          institution_type?: string | null
          invite_code?: string | null
          keywords?: string[] | null
          lattes_url?: string | null
          orcid?: string | null
          org_id: string
          reviewer_id?: string | null
          token_hash?: string | null
          used_at?: string | null
        }
        Update: {
          areas?: Json | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          institution?: string | null
          institution_custom_name?: string | null
          institution_id?: string | null
          institution_type?: string | null
          invite_code?: string | null
          keywords?: string[] | null
          lattes_url?: string | null
          orcid?: string | null
          org_id?: string
          reviewer_id?: string | null
          token_hash?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_invites_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_invites_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "reviewers"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_profiles: {
        Row: {
          accepted_at: string | null
          areas: Json
          bio: string | null
          created_at: string
          first_terms_accepted_at: string | null
          id: string
          keywords: string[] | null
          orcid: string | null
          org_id: string
          terms_version: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          areas?: Json
          bio?: string | null
          created_at?: string
          first_terms_accepted_at?: string | null
          id?: string
          keywords?: string[] | null
          orcid?: string | null
          org_id: string
          terms_version?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          areas?: Json
          bio?: string | null
          created_at?: string
          first_terms_accepted_at?: string | null
          id?: string
          keywords?: string[] | null
          orcid?: string | null
          org_id?: string
          terms_version?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewers: {
        Row: {
          accepted_at: string | null
          areas: Json
          bio: string | null
          cpf_hash: string | null
          cpf_last4: string | null
          created_at: string
          email: string
          first_terms_accepted_at: string | null
          full_name: string
          id: string
          institution: string
          institution_custom_name: string | null
          institution_id: string | null
          institution_type: string | null
          invited_at: string | null
          keywords: string[] | null
          lattes_url: string | null
          orcid: string | null
          org_id: string
          status: string
          terms_version: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          areas?: Json
          bio?: string | null
          cpf_hash?: string | null
          cpf_last4?: string | null
          created_at?: string
          email: string
          first_terms_accepted_at?: string | null
          full_name: string
          id?: string
          institution: string
          institution_custom_name?: string | null
          institution_id?: string | null
          institution_type?: string | null
          invited_at?: string | null
          keywords?: string[] | null
          lattes_url?: string | null
          orcid?: string | null
          org_id: string
          status?: string
          terms_version?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          areas?: Json
          bio?: string | null
          cpf_hash?: string | null
          cpf_last4?: string | null
          created_at?: string
          email?: string
          first_terms_accepted_at?: string | null
          full_name?: string
          id?: string
          institution?: string
          institution_custom_name?: string | null
          institution_id?: string | null
          institution_type?: string | null
          invited_at?: string | null
          keywords?: string[] | null
          lattes_url?: string | null
          orcid?: string | null
          org_id?: string
          status?: string
          terms_version?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviewers_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          assignment_id: string
          comments_to_committee: string | null
          created_at: string
          id: string
          overall_score: number | null
          proposal_id: string
          recommendation: string | null
          reviewer_user_id: string
          submitted_at: string | null
        }
        Insert: {
          assignment_id: string
          comments_to_committee?: string | null
          created_at?: string
          id?: string
          overall_score?: number | null
          proposal_id: string
          recommendation?: string | null
          reviewer_user_id: string
          submitted_at?: string | null
        }
        Update: {
          assignment_id?: string
          comments_to_committee?: string | null
          created_at?: string
          id?: string
          overall_score?: number | null
          proposal_id?: string
          recommendation?: string | null
          reviewer_user_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "review_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "submissions_blind"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      scoring_criteria: {
        Row: {
          created_at: string
          description: string | null
          edital_id: string
          id: string
          max_score: number
          name: string
          sort_order: number
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          edital_id: string
          id?: string
          max_score?: number
          name: string
          sort_order?: number
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          edital_id?: string
          id?: string
          max_score?: number
          name?: string
          sort_order?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "scoring_criteria_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      submissions_blind: {
        Row: {
          blind_code: string | null
          blind_review_enabled: boolean | null
          created_at: string | null
          edital_id: string | null
          edital_title: string | null
          knowledge_area_id: string | null
          knowledge_area_name: string | null
          proposal_content: Json | null
          review_deadline: string | null
          status: Database["public"]["Enums"]["proposal_status"] | null
          submission_id: string | null
          submitted_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_knowledge_area_id_fkey"
            columns: ["knowledge_area_id"]
            isOneToOne: false
            referencedRelation: "knowledge_areas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      ensure_default_membership: { Args: never; Returns: undefined }
      generate_form_code: { Args: { p_org_id: string }; Returns: string }
      generate_submission_protocol: {
        Args: { p_edital_id: string }
        Returns: string
      }
      get_anonymized_proposal: {
        Args: { p_assignment_id: string }
        Returns: Json
      }
      get_proposal_anonymous_id: {
        Args: { p_proposal_id: string }
        Returns: string
      }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      get_user_org_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
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
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_reviewer_assigned: {
        Args: { _proposal_id: string; _user_id: string }
        Returns: boolean
      }
      lookup_email_by_cpf_hash: {
        Args: { p_cpf_hash: string }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role:
        | "icca_admin"
        | "org_admin"
        | "edital_manager"
        | "proponente"
        | "reviewer"
      edital_status:
        | "draft"
        | "published"
        | "closed"
        | "em_avaliacao"
        | "resultado_preliminar"
        | "resultado_final"
        | "homologado"
        | "outorgado"
        | "cancelado"
      field_type:
        | "text"
        | "textarea"
        | "number"
        | "date"
        | "file"
        | "single_select"
        | "multi_select"
        | "checkbox"
        | "radio"
        | "email"
        | "url"
        | "phone"
        | "currency"
      form_status: "draft" | "published" | "archived"
      proposal_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "accepted"
        | "rejected"
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
      app_role: [
        "icca_admin",
        "org_admin",
        "edital_manager",
        "proponente",
        "reviewer",
      ],
      edital_status: [
        "draft",
        "published",
        "closed",
        "em_avaliacao",
        "resultado_preliminar",
        "resultado_final",
        "homologado",
        "outorgado",
        "cancelado",
      ],
      field_type: [
        "text",
        "textarea",
        "number",
        "date",
        "file",
        "single_select",
        "multi_select",
        "checkbox",
        "radio",
        "email",
        "url",
        "phone",
        "currency",
      ],
      form_status: ["draft", "published", "archived"],
      proposal_status: [
        "draft",
        "submitted",
        "under_review",
        "accepted",
        "rejected",
      ],
    },
  },
} as const
