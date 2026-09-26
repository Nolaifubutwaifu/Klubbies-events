// Generated from the Supabase schema (supabase gen types). Do not edit by hand;
// regenerate after each migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      access_events: {
        Row: {
          action: string;
          club_id: string | null;
          created_at: string;
          id: number;
          ip_hash: string | null;
          media_id: string | null;
          membership_id: string | null;
          occurred_at: string;
          updated_at: string;
          user_agent: string | null;
        };
        Insert: {
          action: string;
          club_id?: string | null;
          created_at?: string;
          id?: never;
          ip_hash?: string | null;
          media_id?: string | null;
          membership_id?: string | null;
          occurred_at?: string;
          updated_at?: string;
          user_agent?: string | null;
        };
        Update: {
          action?: string;
          club_id?: string | null;
          created_at?: string;
          id?: never;
          ip_hash?: string | null;
          media_id?: string | null;
          membership_id?: string | null;
          occurred_at?: string;
          updated_at?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "access_events_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "access_events_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "access_events_membership_id_fkey";
            columns: ["membership_id"];
            isOneToOne: false;
            referencedRelation: "memberships";
            referencedColumns: ["id"];
          },
        ];
      };
      album_guest_links: {
        Row: {
          album_id: string;
          byte_total: number;
          club_id: string;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          file_count: number;
          first_used_at: string | null;
          id: string;
          label: string;
          last_used_at: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          token_hash: string;
        };
        Insert: {
          album_id: string;
          byte_total?: number;
          club_id: string;
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          file_count?: number;
          first_used_at?: string | null;
          id?: string;
          label: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          token_hash: string;
        };
        Update: {
          album_id?: string;
          byte_total?: number;
          club_id?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          file_count?: number;
          first_used_at?: string | null;
          id?: string;
          label?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "album_guest_links_album_id_fkey";
            columns: ["album_id"];
            isOneToOne: false;
            referencedRelation: "albums";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "album_guest_links_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "album_guest_links_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "album_guest_links_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      albums: {
        Row: {
          allow_download: boolean;
          club_id: string;
          contributor_scope: string;
          cover_media_id: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          event_date: string | null;
          event_type: string | null;
          id: string;
          publish_at: string | null;
          published_at: string | null;
          sort_order: number;
          status: string;
          title: string;
          updated_at: string;
          visibility: string;
        };
        Insert: {
          allow_download?: boolean;
          club_id: string;
          contributor_scope?: string;
          cover_media_id?: string | null;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          event_date?: string | null;
          event_type?: string | null;
          id?: string;
          publish_at?: string | null;
          published_at?: string | null;
          sort_order?: number;
          status?: string;
          title: string;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          allow_download?: boolean;
          club_id?: string;
          contributor_scope?: string;
          cover_media_id?: string | null;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          event_date?: string | null;
          event_type?: string | null;
          id?: string;
          publish_at?: string | null;
          published_at?: string | null;
          sort_order?: number;
          status?: string;
          title?: string;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "albums_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "albums_cover_media_fk";
            columns: ["cover_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "albums_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      auth_rate_events: {
        Row: {
          bucket: string;
          created_at: string;
          id: number;
          key_hash: string;
          occurred_at: string;
          updated_at: string;
        };
        Insert: {
          bucket: string;
          created_at?: string;
          id?: never;
          key_hash: string;
          occurred_at?: string;
          updated_at?: string;
        };
        Update: {
          bucket?: string;
          created_at?: string;
          id?: never;
          key_hash?: string;
          occurred_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      club_face_settings: {
        Row: {
          backfill_completed_at: string | null;
          backfill_queued_at: string | null;
          backfill_status: string;
          club_id: string;
          collection_id: string | null;
          created_at: string;
          enabled: boolean;
          notice_accepted_at: string | null;
          notice_accepted_by: string | null;
          notice_version: string | null;
          updated_at: string;
        };
        Insert: {
          backfill_completed_at?: string | null;
          backfill_queued_at?: string | null;
          backfill_status?: string;
          club_id: string;
          collection_id?: string | null;
          created_at?: string;
          enabled?: boolean;
          notice_accepted_at?: string | null;
          notice_accepted_by?: string | null;
          notice_version?: string | null;
          updated_at?: string;
        };
        Update: {
          backfill_completed_at?: string | null;
          backfill_queued_at?: string | null;
          backfill_status?: string;
          club_id?: string;
          collection_id?: string | null;
          created_at?: string;
          enabled?: boolean;
          notice_accepted_at?: string | null;
          notice_accepted_by?: string | null;
          notice_version?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_face_settings_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: true;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_face_settings_notice_accepted_by_fkey";
            columns: ["notice_accepted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      club_handle_redirects: {
        Row: {
          club_id: string;
          created_at: string;
          old_handle: string;
          updated_at: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          old_handle: string;
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          old_handle?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_handle_redirects_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      club_roles: {
        Row: {
          club_id: string;
          created_at: string;
          id: string;
          is_builtin: boolean;
          is_default: boolean;
          key: string;
          manage_albums: boolean;
          manage_club: boolean;
          manage_members: boolean;
          name: string;
          post_feed: boolean;
          sort_order: number;
          updated_at: string;
          upload: boolean;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          id?: string;
          is_builtin?: boolean;
          is_default?: boolean;
          key: string;
          manage_albums?: boolean;
          manage_club?: boolean;
          manage_members?: boolean;
          name: string;
          post_feed?: boolean;
          sort_order?: number;
          updated_at?: string;
          upload?: boolean;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          id?: string;
          is_builtin?: boolean;
          is_default?: boolean;
          key?: string;
          manage_albums?: boolean;
          manage_club?: boolean;
          manage_members?: boolean;
          name?: string;
          post_feed?: boolean;
          sort_order?: number;
          updated_at?: string;
          upload?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "club_roles_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      clubs: {
        Row: {
          accent_colour: string | null;
          allow_removal_requests: boolean;
          billing_status: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          grace_period_enabled: boolean;
          handle: string;
          id: string;
          logo_path: string | null;
          name: string;
          organisation: string | null;
          paid_at: string | null;
          roster_mapping: Json | null;
          status: string;
          stripe_checkout_session_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
        };
        Insert: {
          accent_colour?: string | null;
          allow_removal_requests?: boolean;
          billing_status?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          grace_period_enabled?: boolean;
          handle: string;
          id?: string;
          logo_path?: string | null;
          name: string;
          organisation?: string | null;
          paid_at?: string | null;
          roster_mapping?: Json | null;
          status?: string;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Update: {
          accent_colour?: string | null;
          allow_removal_requests?: boolean;
          billing_status?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          grace_period_enabled?: boolean;
          handle?: string;
          id?: string;
          logo_path?: string | null;
          name?: string;
          organisation?: string | null;
          paid_at?: string | null;
          roster_mapping?: Json | null;
          status?: string;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clubs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      face_jobs: {
        Row: {
          attempts: number;
          club_id: string;
          created_at: string;
          id: number;
          kind: string;
          last_error: string | null;
          media_id: string | null;
          profile_id: string | null;
          run_after: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          club_id: string;
          created_at?: string;
          id?: never;
          kind: string;
          last_error?: string | null;
          media_id?: string | null;
          profile_id?: string | null;
          run_after?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          club_id?: string;
          created_at?: string;
          id?: never;
          kind?: string;
          last_error?: string | null;
          media_id?: string | null;
          profile_id?: string | null;
          run_after?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "face_jobs_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "face_jobs_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "face_jobs_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "member_face_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      face_matches: {
        Row: {
          bounding_box: Json | null;
          club_id: string;
          created_at: string;
          decided_at: string | null;
          id: string;
          media_face_id: string;
          media_id: string;
          profile_id: string;
          similarity: number;
          state: string;
          updated_at: string;
        };
        Insert: {
          bounding_box?: Json | null;
          club_id: string;
          created_at?: string;
          decided_at?: string | null;
          id?: string;
          media_face_id: string;
          media_id: string;
          profile_id: string;
          similarity: number;
          state?: string;
          updated_at?: string;
        };
        Update: {
          bounding_box?: Json | null;
          club_id?: string;
          created_at?: string;
          decided_at?: string | null;
          id?: string;
          media_face_id?: string;
          media_id?: string;
          profile_id?: string;
          similarity?: number;
          state?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "face_matches_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "face_matches_media_face_id_fkey";
            columns: ["media_face_id"];
            isOneToOne: false;
            referencedRelation: "media_faces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "face_matches_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "face_matches_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "member_face_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      face_purge_queue: {
        Row: {
          attempts: number;
          collection_id: string;
          created_at: string;
          id: number;
          rekognition_face_id: string;
        };
        Insert: {
          attempts?: number;
          collection_id: string;
          created_at?: string;
          id?: never;
          rekognition_face_id: string;
        };
        Update: {
          attempts?: number;
          collection_id?: string;
          created_at?: string;
          id?: never;
          rekognition_face_id?: string;
        };
        Relationships: [];
      };
      face_rejections: {
        Row: {
          club_id: string;
          created_at: string;
          id: string;
          media_id: string;
          profile_id: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          id?: string;
          media_id: string;
          profile_id: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          id?: string;
          media_id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "face_rejections_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "face_rejections_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "face_rejections_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "member_face_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      favourites: {
        Row: {
          club_id: string;
          created_at: string;
          media_id: string;
          user_id: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          media_id: string;
          user_id: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          media_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favourites_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favourites_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favourites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      media: {
        Row: {
          album_id: string | null;
          byte_size: number | null;
          captured_at: string | null;
          content_hash: string | null;
          club_id: string;
          created_at: string;
          display_path: string | null;
          duration_seconds: number | null;
          guest_link_id: string | null;
          height: number | null;
          hidden_at: string | null;
          id: string;
          kind: string;
          mime_type: string | null;
          original_filename: string | null;
          poster_path: string | null;
          sort_at: string | null;
          status: string;
          storage_path: string;
          thumb_path: string | null;
          updated_at: string;
          uploaded_by: string | null;
          width: number | null;
        };
        Insert: {
          album_id?: string | null;
          byte_size?: number | null;
          captured_at?: string | null;
          content_hash?: string | null;
          club_id: string;
          created_at?: string;
          display_path?: string | null;
          duration_seconds?: number | null;
          guest_link_id?: string | null;
          height?: number | null;
          hidden_at?: string | null;
          id?: string;
          kind: string;
          mime_type?: string | null;
          original_filename?: string | null;
          poster_path?: string | null;
          sort_at?: string | null;
          status?: string;
          storage_path: string;
          thumb_path?: string | null;
          updated_at?: string;
          uploaded_by?: string | null;
          width?: number | null;
        };
        Update: {
          album_id?: string | null;
          byte_size?: number | null;
          captured_at?: string | null;
          content_hash?: string | null;
          club_id?: string;
          created_at?: string;
          display_path?: string | null;
          duration_seconds?: number | null;
          guest_link_id?: string | null;
          height?: number | null;
          hidden_at?: string | null;
          id?: string;
          kind?: string;
          mime_type?: string | null;
          original_filename?: string | null;
          poster_path?: string | null;
          sort_at?: string | null;
          status?: string;
          storage_path?: string;
          thumb_path?: string | null;
          updated_at?: string;
          uploaded_by?: string | null;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "media_album_id_fkey";
            columns: ["album_id"];
            isOneToOne: false;
            referencedRelation: "albums";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_guest_link_id_fkey";
            columns: ["guest_link_id"];
            isOneToOne: false;
            referencedRelation: "album_guest_links";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      media_faces: {
        Row: {
          bounding_box: Json;
          brightness: number | null;
          club_id: string;
          collection_id: string;
          confidence: number | null;
          created_at: string;
          id: string;
          media_id: string;
          rekognition_face_id: string;
          sharpness: number | null;
          updated_at: string;
        };
        Insert: {
          bounding_box: Json;
          brightness?: number | null;
          club_id: string;
          collection_id: string;
          confidence?: number | null;
          created_at?: string;
          id?: string;
          media_id: string;
          rekognition_face_id: string;
          sharpness?: number | null;
          updated_at?: string;
        };
        Update: {
          bounding_box?: Json;
          brightness?: number | null;
          club_id?: string;
          collection_id?: string;
          confidence?: number | null;
          created_at?: string;
          id?: string;
          media_id?: string;
          rekognition_face_id?: string;
          sharpness?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_faces_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_faces_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      media_removal_requests: {
        Row: {
          auto_delete_at: string;
          club_id: string;
          id: string;
          media_id: string;
          requested_at: string;
          requested_by: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
        };
        Insert: {
          auto_delete_at?: string;
          club_id: string;
          id?: string;
          media_id: string;
          requested_at?: string;
          requested_by?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
        };
        Update: {
          auto_delete_at?: string;
          club_id?: string;
          id?: string;
          media_id?: string;
          requested_at?: string;
          requested_by?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_removal_requests_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_removal_requests_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_removal_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_removal_requests_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      member_face_profiles: {
        Row: {
          club_id: string;
          consent_version: string;
          consented_at: string;
          created_at: string;
          failure_reason: string | null;
          id: string;
          membership_id: string;
          revoked_at: string | null;
          selfie_path: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          club_id: string;
          consent_version: string;
          consented_at?: string;
          created_at?: string;
          failure_reason?: string | null;
          id?: string;
          membership_id: string;
          revoked_at?: string | null;
          selfie_path?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          club_id?: string;
          consent_version?: string;
          consented_at?: string;
          created_at?: string;
          failure_reason?: string | null;
          id?: string;
          membership_id?: string;
          revoked_at?: string | null;
          selfie_path?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_face_profiles_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_face_profiles_membership_id_fkey";
            columns: ["membership_id"];
            isOneToOne: true;
            referencedRelation: "memberships";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_face_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      member_face_references: {
        Row: {
          club_id: string;
          collection_id: string;
          created_at: string;
          id: string;
          media_face_id: string | null;
          media_id: string | null;
          profile_id: string;
          quality: number | null;
          rekognition_face_id: string;
          source: string;
        };
        Insert: {
          club_id: string;
          collection_id: string;
          created_at?: string;
          id?: string;
          media_face_id?: string | null;
          media_id?: string | null;
          profile_id: string;
          quality?: number | null;
          rekognition_face_id: string;
          source: string;
        };
        Update: {
          club_id?: string;
          collection_id?: string;
          created_at?: string;
          id?: string;
          media_face_id?: string | null;
          media_id?: string | null;
          profile_id?: string;
          quality?: number | null;
          rekognition_face_id?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_face_references_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_face_references_media_face_id_fkey";
            columns: ["media_face_id"];
            isOneToOne: false;
            referencedRelation: "media_faces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_face_references_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_face_references_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "member_face_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          accepted_at: string | null;
          claimed_name: string | null;
          club_id: string;
          created_at: string;
          declined_at: string | null;
          face_notice_ack_at: string | null;
          face_notice_version: string | null;
          first_seen_at: string | null;
          grace_ends_at: string | null;
          grace_notices_sent: number;
          grace_started_at: string | null;
          id: string;
          invited_at: string | null;
          last_seen_at: string | null;
          name_mismatch: boolean;
          role: string;
          role_id: string | null;
          roster_email: string;
          roster_name: string;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          claimed_name?: string | null;
          club_id: string;
          created_at?: string;
          declined_at?: string | null;
          face_notice_ack_at?: string | null;
          face_notice_version?: string | null;
          first_seen_at?: string | null;
          grace_ends_at?: string | null;
          grace_notices_sent?: number;
          grace_started_at?: string | null;
          id?: string;
          invited_at?: string | null;
          last_seen_at?: string | null;
          name_mismatch?: boolean;
          role?: string;
          role_id?: string | null;
          roster_email: string;
          roster_name: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          claimed_name?: string | null;
          club_id?: string;
          created_at?: string;
          declined_at?: string | null;
          face_notice_ack_at?: string | null;
          face_notice_version?: string | null;
          first_seen_at?: string | null;
          grace_ends_at?: string | null;
          grace_notices_sent?: number;
          grace_started_at?: string | null;
          id?: string;
          invited_at?: string | null;
          last_seen_at?: string | null;
          name_mismatch?: boolean;
          role?: string;
          role_id?: string | null;
          roster_email?: string;
          roster_name?: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "club_roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      pending_sign_ins: {
        Row: {
          attempts: number;
          claimed_name: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          flow: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          claimed_name?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          flow: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          claimed_name?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          flow?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      post_comments: {
        Row: {
          author_membership_id: string | null;
          body: string;
          club_id: string;
          created_at: string;
          id: string;
          post_id: string;
          updated_at: string;
        };
        Insert: {
          author_membership_id?: string | null;
          body: string;
          club_id: string;
          created_at?: string;
          id?: string;
          post_id: string;
          updated_at?: string;
        };
        Update: {
          author_membership_id?: string | null;
          body?: string;
          club_id?: string;
          created_at?: string;
          id?: string;
          post_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_comments_author_membership_id_fkey";
            columns: ["author_membership_id"];
            isOneToOne: false;
            referencedRelation: "memberships";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_comments_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_reactions: {
        Row: {
          club_id: string;
          created_at: string;
          emoji: string;
          membership_id: string;
          post_id: string;
          updated_at: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          emoji: string;
          membership_id: string;
          post_id: string;
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          emoji?: string;
          membership_id?: string;
          post_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_reactions_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_reactions_membership_id_fkey";
            columns: ["membership_id"];
            isOneToOne: false;
            referencedRelation: "memberships";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_reactions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          album_id: string | null;
          author_membership_id: string | null;
          body: string;
          club_id: string;
          created_at: string;
          id: string;
          pinned: boolean;
          updated_at: string;
        };
        Insert: {
          album_id?: string | null;
          author_membership_id?: string | null;
          body: string;
          club_id: string;
          created_at?: string;
          id?: string;
          pinned?: boolean;
          updated_at?: string;
        };
        Update: {
          album_id?: string | null;
          author_membership_id?: string | null;
          body?: string;
          club_id?: string;
          created_at?: string;
          id?: string;
          pinned?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_album_id_fkey";
            columns: ["album_id"];
            isOneToOne: false;
            referencedRelation: "albums";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_author_membership_id_fkey";
            columns: ["author_membership_id"];
            isOneToOne: false;
            referencedRelation: "memberships";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      roster_imports: {
        Row: {
          added_count: number | null;
          club_id: string;
          created_at: string;
          error_count: number | null;
          filename: string | null;
          id: string;
          imported_at: string;
          imported_by: string | null;
          mapping: Json | null;
          matched_count: number | null;
          report: Json | null;
          row_count: number | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          added_count?: number | null;
          club_id: string;
          created_at?: string;
          error_count?: number | null;
          filename?: string | null;
          id?: string;
          imported_at?: string;
          imported_by?: string | null;
          mapping?: Json | null;
          matched_count?: number | null;
          report?: Json | null;
          row_count?: number | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          added_count?: number | null;
          club_id?: string;
          created_at?: string;
          error_count?: number | null;
          filename?: string | null;
          id?: string;
          imported_at?: string;
          imported_by?: string | null;
          mapping?: Json | null;
          matched_count?: number | null;
          report?: Json | null;
          row_count?: number | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roster_imports_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roster_imports_imported_by_fkey";
            columns: ["imported_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          club_id: string | null;
          created_at: string;
          id: string;
          payload: Json;
          processed_at: string | null;
          type: string;
          updated_at: string;
        };
        Insert: {
          club_id?: string | null;
          created_at?: string;
          id: string;
          payload: Json;
          processed_at?: string | null;
          type: string;
          updated_at?: string;
        };
        Update: {
          club_id?: string | null;
          created_at?: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_events_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string | null;
          email: string;
          id: string;
          is_super_admin: boolean;
          notify_access_ending: boolean;
          notify_feed_post: boolean;
          notify_new_album: boolean;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          email: string;
          id: string;
          is_super_admin?: boolean;
          notify_access_ending?: boolean;
          notify_feed_post?: boolean;
          notify_new_album?: boolean;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string;
          id?: string;
          is_super_admin?: boolean;
          notify_access_ending?: boolean;
          notify_feed_post?: boolean;
          notify_new_album?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      album_engagement: {
        Row: {
          album_id: string | null;
          club_id: string | null;
          download_count: number | null;
          member_count: number | null;
          view_count: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "media_album_id_fkey";
            columns: ["album_id"];
            isOneToOne: false;
            referencedRelation: "albums";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      album_media_counts: {
        Row: {
          album_id: string | null;
          first_media_id: string | null;
          photo_count: number | null;
          video_count: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "media_album_id_fkey";
            columns: ["album_id"];
            isOneToOne: false;
            referencedRelation: "albums";
            referencedColumns: ["id"];
          },
        ];
      };
      club_storage_usage: {
        Row: {
          club_id: string | null;
          item_count: number | null;
          total_bytes: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "media_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      claim_face_jobs: {
        Args: { batch_size: number };
        Returns: {
          attempts: number;
          club_id: string;
          created_at: string;
          id: number;
          kind: string;
          last_error: string | null;
          media_id: string | null;
          profile_id: string | null;
          run_after: string;
          status: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "face_jobs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      create_club: {
        Args: {
          p_description: string;
          p_handle_base: string;
          p_name: string;
          p_organisation: string;
        };
        Returns: {
          accent_colour: string | null;
          allow_removal_requests: boolean;
          billing_status: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          grace_period_enabled: boolean;
          handle: string;
          id: string;
          logo_path: string | null;
          name: string;
          organisation: string | null;
          paid_at: string | null;
          roster_mapping: Json | null;
          status: string;
          stripe_checkout_session_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "clubs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      seed_club_roles: { Args: { p_club_id: string }; Returns: undefined };
      touch_club_visit: { Args: { p_club_id: string }; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> = (PublicSchema["Tables"] &
  PublicSchema["Views"])[T] extends { Row: infer R }
  ? R
  : never;

export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];

export type Club = Tables<"clubs">;
export type ClubRole = Tables<"club_roles">;
export type Post = Tables<"posts">;
export type Membership = Tables<"memberships">;
export type Album = Tables<"albums">;
export type Media = Tables<"media">;
export type GuestLink = Tables<"album_guest_links">;
export type RemovalRequest = Tables<"media_removal_requests">;

export type MembershipStatus = "pending" | "active" | "grace" | "revoked";
export type MembershipRole = "club_admin" | "club_member";
export type MediaKind = "photo" | "video";
export type EventType = "formal" | "sport" | "social" | "camp" | "night_out" | "other";
export type ClubFaceSettings = Tables<"club_face_settings">;
export type MediaFace = Tables<"media_faces">;
export type MemberFaceProfile = Tables<"member_face_profiles">;
export type FaceMatch = Tables<"face_matches">;
export type FaceJob = Tables<"face_jobs">;

export type FaceMatchState = "confirmed" | "suggested" | "rejected";
export type FaceJobKind = "index_media" | "rematch_media" | "enrol_profile";
export type FaceProfileStatus = "pending" | "ready" | "failed";
