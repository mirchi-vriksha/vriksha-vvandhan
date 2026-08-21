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
    PostgrestVersion: "14.15"
  }
  private: {
    Tables: {
      application_rate_limits: {
        Row: {
          expires_at: string
          key_hash: string
          request_count: number
          scope: string
          window_started_at: string
        }
        Insert: {
          expires_at: string
          key_hash: string
          request_count?: number
          scope: string
          window_started_at: string
        }
        Update: {
          expires_at?: string
          key_hash?: string
          request_count?: number
          scope?: string
          window_started_at?: string
        }
        Relationships: []
      }
      email_daily_quotas: {
        Row: {
          quota_date: string
          reserved_count: number
          updated_at: string
        }
        Insert: {
          quota_date: string
          reserved_count?: number
          updated_at?: string
        }
        Update: {
          quota_date?: string
          reserved_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_smtp_quota_reservations: {
        Row: {
          claim_token: string
          delivery_id: string
          id: number
          reserved_at: string
        }
        Insert: {
          claim_token: string
          delivery_id: string
          id?: never
          reserved_at?: string
        }
        Update: {
          claim_token?: string
          delivery_id?: string
          id?: never
          reserved_at?: string
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          normalized_email: string
          provider_message_id: string | null
          reason: string
          source_event_id: string | null
          suppressed_at: string
        }
        Insert: {
          normalized_email: string
          provider_message_id?: string | null
          reason: string
          source_event_id?: string | null
          suppressed_at?: string
        }
        Update: {
          normalized_email?: string
          provider_message_id?: string | null
          reason?: string
          source_event_id?: string | null
          suppressed_at?: string
        }
        Relationships: []
      }
      staff_auth_cleanup_queue: {
        Row: {
          attempt_count: number
          display_name: string
          last_attempt_at: string | null
          last_error_code: string | null
          requested_at: string
          requested_by: string | null
          requested_role: Database["public"]["Enums"]["staff_role"]
          staff_id: string
        }
        Insert: {
          attempt_count?: number
          display_name: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          requested_at?: string
          requested_by?: string | null
          requested_role: Database["public"]["Enums"]["staff_role"]
          staff_id: string
        }
        Update: {
          attempt_count?: number
          display_name?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          requested_at?: string
          requested_by?: string | null
          requested_role?: Database["public"]["Enums"]["staff_role"]
          staff_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_published_count: { Args: never; Returns: number }
      current_staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      is_active_staff: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_reviewer_or_admin: { Args: never; Returns: boolean }
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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          reason?: string | null
        }
        Relationships: []
      }
      campaign_settings: {
        Row: {
          created_at: string
          draft_ttl_minutes: number
          id: number
          max_submissions_per_email_24h: number
          metric_label: string
          movement_wall_enabled: boolean
          submissions_open: boolean
          target_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft_ttl_minutes?: number
          id?: number
          max_submissions_per_email_24h?: number
          metric_label?: string
          movement_wall_enabled?: boolean
          submissions_open?: boolean
          target_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft_ttl_minutes?: number
          id?: number
          max_submissions_per_email_24h?: number
          metric_label?: string
          movement_wall_enabled?: boolean
          submissions_open?: boolean
          target_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          attempt_count: number
          bucket: string | null
          checksum_sha256: string | null
          claim_token: string | null
          created_at: string
          file_bytes: number | null
          format: string | null
          generated_at: string | null
          id: string
          last_error_code: string | null
          next_attempt_at: string | null
          object_path: string | null
          queued_at: string | null
          status: Database["public"]["Enums"]["certificate_status"]
          submission_id: string
          template_version: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          bucket?: string | null
          checksum_sha256?: string | null
          claim_token?: string | null
          created_at?: string
          file_bytes?: number | null
          format?: string | null
          generated_at?: string | null
          id?: string
          last_error_code?: string | null
          next_attempt_at?: string | null
          object_path?: string | null
          queued_at?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          submission_id: string
          template_version?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          bucket?: string | null
          checksum_sha256?: string | null
          claim_token?: string | null
          created_at?: string
          file_bytes?: number | null
          format?: string | null
          generated_at?: string | null
          id?: string
          last_error_code?: string | null
          next_attempt_at?: string | null
          object_path?: string | null
          queued_at?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          submission_id?: string
          template_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_deliveries: {
        Row: {
          attempt_count: number
          bounced_at: string | null
          claim_token: string | null
          complained_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_delayed_at: string | null
          first_attempt_at: string | null
          id: string
          idempotency_key: string
          idempotency_version: number
          kind: Database["public"]["Enums"]["email_delivery_kind"]
          last_attempt_at: string | null
          last_error_code: string | null
          next_attempt_at: string | null
          provider_failed_at: string | null
          provider_message_id: string | null
          queued_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_delivery_status"]
          submission_id: string
          suppressed_at: string | null
          suppression_reason: string | null
          template_version: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          bounced_at?: string | null
          claim_token?: string | null
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_delayed_at?: string | null
          first_attempt_at?: string | null
          id?: string
          idempotency_key: string
          idempotency_version?: number
          kind: Database["public"]["Enums"]["email_delivery_kind"]
          last_attempt_at?: string | null
          last_error_code?: string | null
          next_attempt_at?: string | null
          provider_failed_at?: string | null
          provider_message_id?: string | null
          queued_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_delivery_status"]
          submission_id: string
          suppressed_at?: string | null
          suppression_reason?: string | null
          template_version?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          bounced_at?: string | null
          claim_token?: string | null
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_delayed_at?: string | null
          first_attempt_at?: string | null
          id?: string
          idempotency_key?: string
          idempotency_version?: number
          kind?: Database["public"]["Enums"]["email_delivery_kind"]
          last_attempt_at?: string | null
          last_error_code?: string | null
          next_attempt_at?: string | null
          provider_failed_at?: string | null
          provider_message_id?: string | null
          queued_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_delivery_status"]
          submission_id?: string
          suppressed_at?: string | null
          suppression_reason?: string | null
          template_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_deliveries_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_webhook_events: {
        Row: {
          event_created_at: string
          event_detail_code: string | null
          event_id: string
          event_type: string
          provider_message_id: string
          received_at: string
        }
        Insert: {
          event_created_at: string
          event_detail_code?: string | null
          event_id: string
          event_type: string
          provider_message_id: string
          received_at?: string
        }
        Update: {
          event_created_at?: string
          event_detail_code?: string | null
          event_id?: string
          event_type?: string
          provider_message_id?: string
          received_at?: string
        }
        Relationships: []
      }
      email_worker_runs: {
        Row: {
          completed_at: string | null
          error_code: string | null
          failed_count: number
          id: string
          outcome: string
          processed_count: number
          sent_count: number
          started_at: string
        }
        Insert: {
          completed_at?: string | null
          error_code?: string | null
          failed_count?: number
          id?: string
          outcome?: string
          processed_count?: number
          sent_count?: number
          started_at?: string
        }
        Update: {
          completed_at?: string | null
          error_code?: string | null
          failed_count?: number
          id?: string
          outcome?: string
          processed_count?: number
          sent_count?: number
          started_at?: string
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          id: string
          removed_at: string | null
          removed_by: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          id: string
          removed_at?: string | null
          removed_by?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
          removed_at?: string | null
          removed_by?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Relationships: []
      }
      submission_consents: {
        Row: {
          accepted_at: string
          consent_version: string
          created_at: string
          publication_consent: boolean
          submission_id: string
          terms_accepted: boolean
          updated_at: string
        }
        Insert: {
          accepted_at: string
          consent_version: string
          created_at?: string
          publication_consent: boolean
          submission_id: string
          terms_accepted: boolean
          updated_at?: string
        }
        Update: {
          accepted_at?: string
          consent_version?: string
          created_at?: string
          publication_consent?: boolean
          submission_id?: string
          terms_accepted?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_consents_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_contacts: {
        Row: {
          created_at: string
          email: string
          submission_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          submission_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          submission_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_contacts_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_media: {
        Row: {
          alt_text: string | null
          created_at: string
          focal_x: number | null
          focal_y: number | null
          id: string
          original_bucket: string
          original_bytes: number | null
          original_checksum_sha256: string | null
          original_extension: string
          original_height: number | null
          original_mime_type: string | null
          original_path: string
          original_width: number | null
          published_at: string | null
          published_bucket: string | null
          published_card_bytes: number | null
          published_card_height: number | null
          published_card_path: string | null
          published_card_width: number | null
          published_full_bytes: number | null
          published_full_height: number | null
          published_full_path: string | null
          published_full_width: number | null
          published_version: string | null
          removed_at: string | null
          review_thumbnail_bytes: number | null
          review_thumbnail_generated_at: string | null
          review_thumbnail_height: number | null
          review_thumbnail_path: string | null
          review_thumbnail_width: number | null
          status: Database["public"]["Enums"]["media_status"]
          submission_id: string
          updated_at: string
          uploaded_at: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          focal_x?: number | null
          focal_y?: number | null
          id?: string
          original_bucket?: string
          original_bytes?: number | null
          original_checksum_sha256?: string | null
          original_extension: string
          original_height?: number | null
          original_mime_type?: string | null
          original_path: string
          original_width?: number | null
          published_at?: string | null
          published_bucket?: string | null
          published_card_bytes?: number | null
          published_card_height?: number | null
          published_card_path?: string | null
          published_card_width?: number | null
          published_full_bytes?: number | null
          published_full_height?: number | null
          published_full_path?: string | null
          published_full_width?: number | null
          published_version?: string | null
          removed_at?: string | null
          review_thumbnail_bytes?: number | null
          review_thumbnail_generated_at?: string | null
          review_thumbnail_height?: number | null
          review_thumbnail_path?: string | null
          review_thumbnail_width?: number | null
          status?: Database["public"]["Enums"]["media_status"]
          submission_id: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          focal_x?: number | null
          focal_y?: number | null
          id?: string
          original_bucket?: string
          original_bytes?: number | null
          original_checksum_sha256?: string | null
          original_extension?: string
          original_height?: number | null
          original_mime_type?: string | null
          original_path?: string
          original_width?: number | null
          published_at?: string | null
          published_bucket?: string | null
          published_card_bytes?: number | null
          published_card_height?: number | null
          published_card_path?: string | null
          published_card_width?: number | null
          published_full_bytes?: number | null
          published_full_height?: number | null
          published_full_path?: string | null
          published_full_width?: number | null
          published_version?: string | null
          removed_at?: string | null
          review_thumbnail_bytes?: number | null
          review_thumbnail_generated_at?: string | null
          review_thumbnail_height?: number | null
          review_thumbnail_path?: string | null
          review_thumbnail_width?: number | null
          status?: Database["public"]["Enums"]["media_status"]
          submission_id?: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submission_media_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          counts_toward_goal: boolean
          created_at: string
          created_by_staff_id: string | null
          display_name: string | null
          draft_expires_at: string | null
          guardian_number: number | null
          id: string
          is_test: boolean
          public_request_token_hash: string | null
          published_at: string | null
          rejected_at: string | null
          rejection_comment: string | null
          rejection_confirmed_at: string | null
          rejection_confirmed_by: string | null
          rejection_internal_note: string | null
          rejection_participant_note: string | null
          rejection_reason_code: string | null
          rejection_recommended_at: string | null
          rejection_recommended_by: string | null
          source: Database["public"]["Enums"]["submission_source"]
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          trashed_at: string | null
          trashed_by: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          counts_toward_goal?: boolean
          created_at?: string
          created_by_staff_id?: string | null
          display_name?: string | null
          draft_expires_at?: string | null
          guardian_number?: number | null
          id?: string
          is_test?: boolean
          public_request_token_hash?: string | null
          published_at?: string | null
          rejected_at?: string | null
          rejection_comment?: string | null
          rejection_confirmed_at?: string | null
          rejection_confirmed_by?: string | null
          rejection_internal_note?: string | null
          rejection_participant_note?: string | null
          rejection_reason_code?: string | null
          rejection_recommended_at?: string | null
          rejection_recommended_by?: string | null
          source?: Database["public"]["Enums"]["submission_source"]
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          trashed_at?: string | null
          trashed_by?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          counts_toward_goal?: boolean
          created_at?: string
          created_by_staff_id?: string | null
          display_name?: string | null
          draft_expires_at?: string | null
          guardian_number?: number | null
          id?: string
          is_test?: boolean
          public_request_token_hash?: string | null
          published_at?: string | null
          rejected_at?: string | null
          rejection_comment?: string | null
          rejection_confirmed_at?: string | null
          rejection_confirmed_by?: string | null
          rejection_internal_note?: string | null
          rejection_participant_note?: string | null
          rejection_reason_code?: string | null
          rejection_recommended_at?: string | null
          rejection_recommended_by?: string | null
          source?: Database["public"]["Enums"]["submission_source"]
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          trashed_at?: string | null
          trashed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_created_by_staff_id_fkey"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_rejection_confirmed_by_fkey"
            columns: ["rejection_confirmed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_rejection_recommended_by_fkey"
            columns: ["rejection_recommended_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_trashed_by_fkey"
            columns: ["trashed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      begin_email_worker_run: { Args: never; Returns: string }
      claim_certificate_generation: {
        Args: {
          p_allow_exhausted: boolean
          p_force_regeneration: boolean
          p_submission_id: string
          p_template_version: string
        }
        Returns: {
          approved_at: string
          certificate_id: string
          claim_token: string
          display_name: string
          guardian_number: number
          previous_object_path: string
        }[]
      }
      claim_email_delivery: {
        Args: {
          p_allow_exhausted?: boolean
          p_daily_limit?: number
          p_delivery_id: string
          p_next_window?: string
          p_quota_date?: string
        }
        Returns: {
          certificate_bucket: string
          certificate_path: string
          claim_token: string
          delivery_id: string
          display_name: string
          guardian_number: number
          idempotency_key: string
          kind: Database["public"]["Enums"]["email_delivery_kind"]
          recipient_email: string
          rejection_comment: string
          rejection_participant_note: string
          rejection_reason_code: string
          submission_id: string
        }[]
      }
      claim_email_delivery_rolling: {
        Args: {
          p_allow_exhausted: boolean
          p_delivery_id: string
          p_rolling_limit: number
        }
        Returns: {
          certificate_bucket: string
          certificate_path: string
          claim_token: string
          delivery_id: string
          display_name: string
          guardian_number: number
          idempotency_key: string
          kind: Database["public"]["Enums"]["email_delivery_kind"]
          recipient_email: string
          rejection_comment: string
          rejection_participant_note: string
          rejection_reason_code: string
          submission_id: string
        }[]
      }
      complete_certificate_generation: {
        Args: {
          p_certificate_id: string
          p_checksum_sha256: string
          p_claim_token: string
          p_file_bytes: number
          p_object_path: string
          p_template_version: string
        }
        Returns: boolean
      }
      complete_email_delivery: {
        Args: {
          p_claim_token: string
          p_delivery_id: string
          p_provider_message_id: string
          p_template_version: string
        }
        Returns: boolean
      }
      complete_email_worker_run: {
        Args: {
          p_error_code?: string
          p_failed_count: number
          p_outcome: string
          p_processed_count: number
          p_run_id: string
          p_sent_count: number
        }
        Returns: boolean
      }
      confirm_submission_rejection: {
        Args: {
          p_internal_note: string
          p_participant_note: string
          p_reason_code: string
          p_submission_id: string
        }
        Returns: undefined
      }
      consume_application_rate_limit: {
        Args: {
          p_key_hash: string
          p_limit: number
          p_scope: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      create_staff_profile: {
        Args: {
          p_active: boolean
          p_display_name: string
          p_role: Database["public"]["Enums"]["staff_role"]
          p_staff_id: string
        }
        Returns: undefined
      }
      delete_trashed_submission: {
        Args: { p_reason: string; p_submission_id: string }
        Returns: undefined
      }
      fail_certificate_generation: {
        Args: {
          p_certificate_id: string
          p_claim_token: string
          p_error_code: string
        }
        Returns: boolean
      }
      fail_email_delivery: {
        Args: {
          p_claim_token: string
          p_delivery_id: string
          p_error_code: string
        }
        Returns: boolean
      }
      finalize_public_submission: {
        Args: {
          p_public_request_token_hash: string
          p_submission_id: string
          p_verified_bytes: number
          p_verified_height: number
          p_verified_mime_type: string
          p_verified_sha256: string
          p_verified_width: number
        }
        Returns: {
          status: Database["public"]["Enums"]["submission_status"]
          submission_id: string
        }[]
      }
      finalize_public_submission_with_review_thumbnail: {
        Args: {
          p_public_request_token_hash: string
          p_review_thumbnail_bytes: number
          p_review_thumbnail_generated_at: string
          p_review_thumbnail_height: number
          p_review_thumbnail_path: string
          p_review_thumbnail_width: number
          p_submission_id: string
          p_verified_bytes: number
          p_verified_height: number
          p_verified_mime_type: string
          p_verified_sha256: string
          p_verified_width: number
        }
        Returns: {
          status: Database["public"]["Enums"]["submission_status"]
          submission_id: string
        }[]
      }
      get_public_campaign_summary: {
        Args: never
        Returns: {
          current_count: number
          metric_label: string
          movement_wall_enabled: boolean
          submissions_open: boolean
          target_count: number
        }[]
      }
      list_due_certificate_work: {
        Args: { p_limit: number }
        Returns: {
          submission_id: string
        }[]
      }
      list_due_email_work: {
        Args: { p_limit: number }
        Returns: {
          delivery_id: string
        }[]
      }
      list_public_movement_entries: {
        Args: {
          p_before_guardian_number?: number
          p_before_published_at?: string
          p_limit?: number
        }
        Returns: {
          alt_text: string
          card_height: number
          card_path: string
          card_width: number
          display_name: string
          focal_x: number
          focal_y: number
          full_height: number
          full_path: string
          full_width: number
          guardian_number: number
          published_at: string
        }[]
      }
      manage_staff_profile: {
        Args: {
          p_active: boolean
          p_display_name: string
          p_role: Database["public"]["Enums"]["staff_role"]
          p_staff_id: string
        }
        Returns: undefined
      }
      mark_staff_auth_cleanup_pending: {
        Args: { p_error_code: string; p_staff_id: string }
        Returns: undefined
      }
      prepare_email_admin_retry: {
        Args: { p_delivery_id: string }
        Returns: boolean
      }
      prepare_public_submission: {
        Args: {
          p_consent_version: string
          p_display_name: string
          p_email: string
          p_original_extension: string
          p_public_request_token_hash: string
          p_publication_consent: boolean
          p_terms_accepted: boolean
        }
        Returns: {
          draft_expires_at: string
          original_extension: string
          original_path: string
          status: Database["public"]["Enums"]["submission_status"]
          submission_id: string
        }[]
      }
      prepare_staff_removal: {
        Args: { p_staff_id: string }
        Returns: undefined
      }
      publish_submission: {
        Args: {
          p_alt_text: string
          p_card_bytes: number
          p_card_height: number
          p_card_path: string
          p_card_width: number
          p_full_bytes: number
          p_full_height: number
          p_full_path: string
          p_full_width: number
          p_guardian_number: number
          p_published_version: string
          p_submission_id: string
        }
        Returns: {
          already_published: boolean
          card_path: string
          full_path: string
          guardian_number: number
        }[]
      }
      purge_email_webhook_events: {
        Args: { p_limit?: number; p_retention_days?: number }
        Returns: number
      }
      purge_expired_rate_limits: { Args: { p_limit?: number }; Returns: number }
      recommend_submission_rejection: {
        Args: {
          p_internal_note: string
          p_participant_note: string
          p_reason_code: string
          p_submission_id: string
        }
        Returns: undefined
      }
      record_campaign_data_export: {
        Args: { p_row_count: number }
        Returns: undefined
      }
      record_delivery_admin_action: {
        Args: { p_action: string; p_delivery_id: string }
        Returns: undefined
      }
      record_resend_webhook_event: {
        Args: {
          p_event_created_at: string
          p_event_detail_code: string
          p_event_id: string
          p_event_type: string
          p_provider_message_id: string
        }
        Returns: boolean
      }
      record_staff_removal: { Args: { p_staff_id: string }; Returns: undefined }
      recover_stale_delivery_claims: {
        Args: { p_stale_minutes?: number }
        Returns: {
          certificates_recovered: number
          emails_recovered: number
        }[]
      }
      reserve_guardian_number_for_publication: {
        Args: { p_actor_id: string; p_submission_id: string }
        Returns: number
      }
      restore_nonpublished_submission: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      restore_published_submission: {
        Args: {
          p_card_bytes: number
          p_card_height: number
          p_card_path: string
          p_card_width: number
          p_full_bytes: number
          p_full_height: number
          p_full_path: string
          p_full_width: number
          p_published_version: string
          p_submission_id: string
        }
        Returns: undefined
      }
      trash_submission: {
        Args: { p_submission_id: string }
        Returns: {
          card_path: string
          certificate_path: string
          full_path: string
          workflow_status: Database["public"]["Enums"]["submission_status"]
        }[]
      }
      update_campaign_settings: {
        Args: {
          p_metric_label: string
          p_movement_wall_enabled: boolean
          p_submissions_open: boolean
          p_target_count: number
        }
        Returns: undefined
      }
      update_submission_review_fields: {
        Args: {
          p_display_name: string
          p_focal_x: number
          p_focal_y: number
          p_submission_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      certificate_status: "not_started" | "queued" | "generated" | "failed"
      email_delivery_kind:
        | "submission_received"
        | "approval_certificate"
        | "rejection"
      email_delivery_status:
        | "not_started"
        | "queued"
        | "sent"
        | "failed"
        | "suppressed"
        | "manual_review"
      media_status: "reserved" | "uploaded" | "published" | "removed"
      staff_role: "admin" | "reviewer"
      submission_source: "website" | "internal_test"
      submission_status:
        | "draft"
        | "pending_review"
        | "rejection_pending_admin"
        | "published"
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
  private: {
    Enums: {},
  },
  public: {
    Enums: {
      certificate_status: ["not_started", "queued", "generated", "failed"],
      email_delivery_kind: [
        "submission_received",
        "approval_certificate",
        "rejection",
      ],
      email_delivery_status: [
        "not_started",
        "queued",
        "sent",
        "failed",
        "suppressed",
        "manual_review",
      ],
      media_status: ["reserved", "uploaded", "published", "removed"],
      staff_role: ["admin", "reviewer"],
      submission_source: ["website", "internal_test"],
      submission_status: [
        "draft",
        "pending_review",
        "rejection_pending_admin",
        "published",
        "rejected",
      ],
    },
  },
} as const
