// Generated from the Supabase schema (supabase gen types typescript --local).
// Do not edit above the aliases; regenerate after each migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "access_events": {
                  Row: {
                    "action": string,"created_at": string,"event_id": string | null,"id": number,"ip_hash": string | null,"media_id": string | null,"membership_id": string | null,"occurred_at": string,"updated_at": string,"user_agent": string | null
                  }
                  Insert: {
                    "action": string,"created_at"?: string,"event_id"?: string | null,"id"?: never,"ip_hash"?: string | null,"media_id"?: string | null,"membership_id"?: string | null,"occurred_at"?: string,"updated_at"?: string,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"event_id"?: string | null,"id"?: never,"ip_hash"?: string | null,"media_id"?: string | null,"membership_id"?: string | null,"occurred_at"?: string,"updated_at"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "access_events_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_events_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_events_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    }
                  ]
                },"album_guest_links": {
                  Row: {
                    "album_id": string,"byte_total": number,"created_at": string,"created_by": string | null,"event_id": string,"expires_at": string,"file_count": number,"first_used_at": string | null,"id": string,"label": string,"last_used_at": string | null,"revoked_at": string | null,"revoked_by": string | null,"token_hash": string
                  }
                  Insert: {
                    "album_id": string,"byte_total"?: number,"created_at"?: string,"created_by"?: string | null,"event_id": string,"expires_at": string,"file_count"?: number,"first_used_at"?: string | null,"id"?: string,"label": string,"last_used_at"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"token_hash": string
                  }
                  Update: {
                    "album_id"?: string,"byte_total"?: number,"created_at"?: string,"created_by"?: string | null,"event_id"?: string,"expires_at"?: string,"file_count"?: number,"first_used_at"?: string | null,"id"?: string,"label"?: string,"last_used_at"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "album_guest_links_album_id_fkey"
      columns: ["album_id"]
isOneToOne: false
      referencedRelation: "albums"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "album_guest_links_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "album_guest_links_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "album_guest_links_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"albums": {
                  Row: {
                    "album_date": string | null,"allow_download": boolean,"contributor_scope": string,"cover_media_id": string | null,"cover_path": string | null,"created_at": string,"created_by": string | null,"description": string | null,"event_id": string,"id": string,"publish_at": string | null,"published_at": string | null,"sort_order": number,"status": string,"title": string,"updated_at": string,"visibility": string
                  }
                  Insert: {
                    "album_date"?: string | null,"allow_download"?: boolean,"contributor_scope"?: string,"cover_media_id"?: string | null,"cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"event_id": string,"id"?: string,"publish_at"?: string | null,"published_at"?: string | null,"sort_order"?: number,"status"?: string,"title": string,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "album_date"?: string | null,"allow_download"?: boolean,"contributor_scope"?: string,"cover_media_id"?: string | null,"cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"event_id"?: string,"id"?: string,"publish_at"?: string | null,"published_at"?: string | null,"sort_order"?: number,"status"?: string,"title"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "albums_cover_media_fk"
      columns: ["cover_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "albums_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "albums_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"auth_rate_events": {
                  Row: {
                    "bucket": string,"created_at": string,"id": number,"key_hash": string,"occurred_at": string,"updated_at": string
                  }
                  Insert: {
                    "bucket": string,"created_at"?: string,"id"?: never,"key_hash": string,"occurred_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "bucket"?: string,"created_at"?: string,"id"?: never,"key_hash"?: string,"occurred_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"event_face_settings": {
                  Row: {
                    "backfill_completed_at": string | null,"backfill_queued_at": string | null,"backfill_status": string,"collection_id": string | null,"created_at": string,"enabled": boolean,"event_id": string,"notice_accepted_at": string | null,"notice_accepted_by": string | null,"notice_version": string | null,"updated_at": string
                  }
                  Insert: {
                    "backfill_completed_at"?: string | null,"backfill_queued_at"?: string | null,"backfill_status"?: string,"collection_id"?: string | null,"created_at"?: string,"enabled"?: boolean,"event_id": string,"notice_accepted_at"?: string | null,"notice_accepted_by"?: string | null,"notice_version"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "backfill_completed_at"?: string | null,"backfill_queued_at"?: string | null,"backfill_status"?: string,"collection_id"?: string | null,"created_at"?: string,"enabled"?: boolean,"event_id"?: string,"notice_accepted_at"?: string | null,"notice_accepted_by"?: string | null,"notice_version"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_face_settings_event_id_fkey"
      columns: ["event_id"]
isOneToOne: true
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_face_settings_notice_accepted_by_fkey"
      columns: ["notice_accepted_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"event_handle_redirects": {
                  Row: {
                    "created_at": string,"event_id": string,"old_handle": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"event_id": string,"old_handle": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"old_handle"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_handle_redirects_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_roles": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"is_builtin": boolean,"is_default": boolean,"key": string,"manage_albums": boolean,"manage_event": boolean,"manage_members": boolean,"name": string,"sort_order": number,"updated_at": string,"upload": boolean
                  }
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"is_builtin"?: boolean,"is_default"?: boolean,"key": string,"manage_albums"?: boolean,"manage_event"?: boolean,"manage_members"?: boolean,"name": string,"sort_order"?: number,"updated_at"?: string,"upload"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"is_builtin"?: boolean,"is_default"?: boolean,"key"?: string,"manage_albums"?: boolean,"manage_event"?: boolean,"manage_members"?: boolean,"name"?: string,"sort_order"?: number,"updated_at"?: string,"upload"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_roles_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "accent_colour": string | null,"access_ends_at": string | null,"access_mode": string,"access_notice_sent_at": string | null,"allow_removal_requests": boolean,"billing_status": string,"created_at": string,"created_by": string | null,"description": string | null,"ends_on": string | null,"grace_period_enabled": boolean,"handle": string,"id": string,"logo_path": string | null,"name": string,"organisation": string | null,"paid_at": string | null,"roster_mapping": Json | null,"starts_on": string | null,"status": string,"stripe_checkout_session_id": string | null,"stripe_customer_id": string | null,"stripe_subscription_id": string | null,"updated_at": string,"venue": string | null
                  }
                  Insert: {
                    "accent_colour"?: string | null,"access_ends_at"?: string | null,"access_mode"?: string,"access_notice_sent_at"?: string | null,"allow_removal_requests"?: boolean,"billing_status"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"ends_on"?: string | null,"grace_period_enabled"?: boolean,"handle": string,"id"?: string,"logo_path"?: string | null,"name": string,"organisation"?: string | null,"paid_at"?: string | null,"roster_mapping"?: Json | null,"starts_on"?: string | null,"status"?: string,"stripe_checkout_session_id"?: string | null,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"updated_at"?: string,"venue"?: string | null
                  }
                  Update: {
                    "accent_colour"?: string | null,"access_ends_at"?: string | null,"access_mode"?: string,"access_notice_sent_at"?: string | null,"allow_removal_requests"?: boolean,"billing_status"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"ends_on"?: string | null,"grace_period_enabled"?: boolean,"handle"?: string,"id"?: string,"logo_path"?: string | null,"name"?: string,"organisation"?: string | null,"paid_at"?: string | null,"roster_mapping"?: Json | null,"starts_on"?: string | null,"status"?: string,"stripe_checkout_session_id"?: string | null,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"updated_at"?: string,"venue"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"face_jobs": {
                  Row: {
                    "attempts": number,"created_at": string,"event_id": string,"id": number,"kind": string,"last_error": string | null,"media_id": string | null,"profile_id": string | null,"run_after": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"event_id": string,"id"?: never,"kind": string,"last_error"?: string | null,"media_id"?: string | null,"profile_id"?: string | null,"run_after"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"event_id"?: string,"id"?: never,"kind"?: string,"last_error"?: string | null,"media_id"?: string | null,"profile_id"?: string | null,"run_after"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "face_jobs_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "face_jobs_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "face_jobs_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "member_face_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"face_matches": {
                  Row: {
                    "bounding_box": Json | null,"created_at": string,"decided_at": string | null,"event_id": string,"id": string,"media_face_id": string,"media_id": string,"profile_id": string,"similarity": number,"state": string,"updated_at": string
                  }
                  Insert: {
                    "bounding_box"?: Json | null,"created_at"?: string,"decided_at"?: string | null,"event_id": string,"id"?: string,"media_face_id": string,"media_id": string,"profile_id": string,"similarity": number,"state"?: string,"updated_at"?: string
                  }
                  Update: {
                    "bounding_box"?: Json | null,"created_at"?: string,"decided_at"?: string | null,"event_id"?: string,"id"?: string,"media_face_id"?: string,"media_id"?: string,"profile_id"?: string,"similarity"?: number,"state"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "face_matches_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "face_matches_media_face_id_fkey"
      columns: ["media_face_id"]
isOneToOne: false
      referencedRelation: "media_faces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "face_matches_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "face_matches_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "member_face_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"face_purge_queue": {
                  Row: {
                    "attempts": number,"collection_id": string,"created_at": string,"id": number,"rekognition_face_id": string
                  }
                  Insert: {
                    "attempts"?: number,"collection_id": string,"created_at"?: string,"id"?: never,"rekognition_face_id": string
                  }
                  Update: {
                    "attempts"?: number,"collection_id"?: string,"created_at"?: string,"id"?: never,"rekognition_face_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"face_rejections": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"media_id": string,"profile_id": string
                  }
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"media_id": string,"profile_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"media_id"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "face_rejections_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "face_rejections_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "face_rejections_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "member_face_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"favourites": {
                  Row: {
                    "created_at": string,"event_id": string,"media_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"event_id": string,"media_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"media_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favourites_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favourites_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favourites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"media": {
                  Row: {
                    "album_id": string | null,"byte_size": number | null,"captured_at": string | null,"content_hash": string | null,"created_at": string,"display_path": string | null,"duration_seconds": number | null,"event_id": string,"guest_link_id": string | null,"height": number | null,"hidden_at": string | null,"id": string,"kind": string,"mime_type": string | null,"original_filename": string | null,"photographer_name": string | null,"poster_path": string | null,"sort_at": string | null,"status": string,"storage_path": string,"thumb_path": string | null,"updated_at": string,"uploaded_by": string | null,"width": number | null
                  }
                  Insert: {
                    "album_id"?: string | null,"byte_size"?: number | null,"captured_at"?: string | null,"content_hash"?: string | null,"created_at"?: string,"display_path"?: string | null,"duration_seconds"?: number | null,"event_id": string,"guest_link_id"?: string | null,"height"?: number | null,"hidden_at"?: string | null,"id"?: string,"kind": string,"mime_type"?: string | null,"original_filename"?: string | null,"photographer_name"?: string | null,"poster_path"?: string | null,"sort_at"?: never,"status"?: string,"storage_path": string,"thumb_path"?: string | null,"updated_at"?: string,"uploaded_by"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "album_id"?: string | null,"byte_size"?: number | null,"captured_at"?: string | null,"content_hash"?: string | null,"created_at"?: string,"display_path"?: string | null,"duration_seconds"?: number | null,"event_id"?: string,"guest_link_id"?: string | null,"height"?: number | null,"hidden_at"?: string | null,"id"?: string,"kind"?: string,"mime_type"?: string | null,"original_filename"?: string | null,"photographer_name"?: string | null,"poster_path"?: string | null,"sort_at"?: never,"status"?: string,"storage_path"?: string,"thumb_path"?: string | null,"updated_at"?: string,"uploaded_by"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_album_id_fkey"
      columns: ["album_id"]
isOneToOne: false
      referencedRelation: "albums"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_guest_link_id_fkey"
      columns: ["guest_link_id"]
isOneToOne: false
      referencedRelation: "album_guest_links"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"media_faces": {
                  Row: {
                    "bounding_box": NonNullable<Json>,"brightness": number | null,"collection_id": string,"confidence": number | null,"created_at": string,"event_id": string,"id": string,"media_id": string,"rekognition_face_id": string,"sharpness": number | null,"updated_at": string
                  }
                  Insert: {
                    "bounding_box": NonNullable<Json>,"brightness"?: number | null,"collection_id": string,"confidence"?: number | null,"created_at"?: string,"event_id": string,"id"?: string,"media_id": string,"rekognition_face_id": string,"sharpness"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "bounding_box"?: NonNullable<Json>,"brightness"?: number | null,"collection_id"?: string,"confidence"?: number | null,"created_at"?: string,"event_id"?: string,"id"?: string,"media_id"?: string,"rekognition_face_id"?: string,"sharpness"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_faces_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_faces_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    }
                  ]
                },"media_removal_requests": {
                  Row: {
                    "auto_delete_at": string,"event_id": string,"id": string,"media_id": string,"requested_at": string,"requested_by": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": string
                  }
                  Insert: {
                    "auto_delete_at"?: string,"event_id": string,"id"?: string,"media_id": string,"requested_at"?: string,"requested_by"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "auto_delete_at"?: string,"event_id"?: string,"id"?: string,"media_id"?: string,"requested_at"?: string,"requested_by"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_removal_requests_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_removal_requests_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_removal_requests_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_removal_requests_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"member_face_profiles": {
                  Row: {
                    "consent_version": string,"consented_at": string,"created_at": string,"event_id": string,"failure_reason": string | null,"id": string,"membership_id": string,"revoked_at": string | null,"selfie_path": string | null,"status": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "consent_version": string,"consented_at"?: string,"created_at"?: string,"event_id": string,"failure_reason"?: string | null,"id"?: string,"membership_id": string,"revoked_at"?: string | null,"selfie_path"?: string | null,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "consent_version"?: string,"consented_at"?: string,"created_at"?: string,"event_id"?: string,"failure_reason"?: string | null,"id"?: string,"membership_id"?: string,"revoked_at"?: string | null,"selfie_path"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_face_profiles_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_face_profiles_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: true
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_face_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"member_face_references": {
                  Row: {
                    "collection_id": string,"created_at": string,"event_id": string,"id": string,"media_face_id": string | null,"media_id": string | null,"profile_id": string,"quality": number | null,"rekognition_face_id": string,"source": string
                  }
                  Insert: {
                    "collection_id": string,"created_at"?: string,"event_id": string,"id"?: string,"media_face_id"?: string | null,"media_id"?: string | null,"profile_id": string,"quality"?: number | null,"rekognition_face_id": string,"source": string
                  }
                  Update: {
                    "collection_id"?: string,"created_at"?: string,"event_id"?: string,"id"?: string,"media_face_id"?: string | null,"media_id"?: string | null,"profile_id"?: string,"quality"?: number | null,"rekognition_face_id"?: string,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_face_references_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_face_references_media_face_id_fkey"
      columns: ["media_face_id"]
isOneToOne: false
      referencedRelation: "media_faces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_face_references_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_face_references_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "member_face_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "accepted_at": string | null,"claimed_name": string | null,"created_at": string,"declined_at": string | null,"event_id": string,"face_notice_ack_at": string | null,"face_notice_version": string | null,"first_seen_at": string | null,"grace_ends_at": string | null,"grace_notices_sent": number,"grace_started_at": string | null,"id": string,"invited_at": string | null,"last_seen_at": string | null,"name_mismatch": boolean,"role": string,"role_id": string | null,"roster_email": string,"roster_name": string,"status": string,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "accepted_at"?: string | null,"claimed_name"?: string | null,"created_at"?: string,"declined_at"?: string | null,"event_id": string,"face_notice_ack_at"?: string | null,"face_notice_version"?: string | null,"first_seen_at"?: string | null,"grace_ends_at"?: string | null,"grace_notices_sent"?: number,"grace_started_at"?: string | null,"id"?: string,"invited_at"?: string | null,"last_seen_at"?: string | null,"name_mismatch"?: boolean,"role"?: string,"role_id"?: string | null,"roster_email": string,"roster_name": string,"status"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"claimed_name"?: string | null,"created_at"?: string,"declined_at"?: string | null,"event_id"?: string,"face_notice_ack_at"?: string | null,"face_notice_version"?: string | null,"first_seen_at"?: string | null,"grace_ends_at"?: string | null,"grace_notices_sent"?: number,"grace_started_at"?: string | null,"id"?: string,"invited_at"?: string | null,"last_seen_at"?: string | null,"name_mismatch"?: boolean,"role"?: string,"role_id"?: string | null,"roster_email"?: string,"roster_name"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "event_roles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"pending_sign_ins": {
                  Row: {
                    "attempts": number,"claimed_name": string | null,"created_at": string,"email": string,"event_id": string | null,"expires_at": string,"flow": string,"updated_at": string
                  }
                  Insert: {
                    "attempts"?: number,"claimed_name"?: string | null,"created_at"?: string,"email": string,"event_id"?: string | null,"expires_at": string,"flow": string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"claimed_name"?: string | null,"created_at"?: string,"email"?: string,"event_id"?: string | null,"expires_at"?: string,"flow"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pending_sign_ins_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"roster_imports": {
                  Row: {
                    "added_count": number | null,"created_at": string,"error_count": number | null,"event_id": string,"filename": string | null,"id": string,"imported_at": string,"imported_by": string | null,"mapping": Json | null,"matched_count": number | null,"report": Json | null,"row_count": number | null,"status": string,"updated_at": string
                  }
                  Insert: {
                    "added_count"?: number | null,"created_at"?: string,"error_count"?: number | null,"event_id": string,"filename"?: string | null,"id"?: string,"imported_at"?: string,"imported_by"?: string | null,"mapping"?: Json | null,"matched_count"?: number | null,"report"?: Json | null,"row_count"?: number | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "added_count"?: number | null,"created_at"?: string,"error_count"?: number | null,"event_id"?: string,"filename"?: string | null,"id"?: string,"imported_at"?: string,"imported_by"?: string | null,"mapping"?: Json | null,"matched_count"?: number | null,"report"?: Json | null,"row_count"?: number | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roster_imports_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roster_imports_imported_by_fkey"
      columns: ["imported_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"stripe_events": {
                  Row: {
                    "created_at": string,"event_id": string | null,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"type": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"event_id"?: string | null,"id": string,"payload": NonNullable<Json>,"processed_at"?: string | null,"type": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stripe_events_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"users": {
                  Row: {
                    "avatar_url": string | null,"bio": string | null,"created_at": string,"display_name": string | null,"email": string,"id": string,"is_super_admin": boolean,"notify_access_ending": boolean,"notify_new_album": boolean,"updated_at": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"display_name"?: string | null,"email": string,"id": string,"is_super_admin"?: boolean,"notify_access_ending"?: boolean,"notify_new_album"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"display_name"?: string | null,"email"?: string,"id"?: string,"is_super_admin"?: boolean,"notify_access_ending"?: boolean,"notify_new_album"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "album_engagement": {
                  Row: {
                    "album_id": string | null,"download_count": number | null,"event_id": string | null,"member_count": number | null,"view_count": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_album_id_fkey"
      columns: ["album_id"]
isOneToOne: false
      referencedRelation: "albums"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"album_media_counts": {
                  Row: {
                    "album_id": string | null,"first_media_id": string | null,"photo_count": number | null,"video_count": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_album_id_fkey"
      columns: ["album_id"]
isOneToOne: false
      referencedRelation: "albums"
      referencedColumns: ["id"]
    }
                  ]
                },"event_storage_usage": {
                  Row: {
                    "event_id": string | null,"item_count": number | null,"total_bytes": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "claim_face_jobs":
{ Args: { "batch_size": number }; Returns: {
              "attempts": number,
"created_at": string,
"event_id": string,
"id": number,
"kind": string,
"last_error": string | null,
"media_id": string | null,
"profile_id": string | null,
"run_after": string,
"status": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "face_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"create_event":
{ Args: { "p_access_mode"?: string,"p_description": string,"p_ends_on"?: string,"p_handle_base": string,"p_name": string,"p_organisation": string,"p_starts_on"?: string,"p_venue"?: string }; Returns: {
              "accent_colour": string | null,
"access_ends_at": string | null,
"access_mode": string,
"access_notice_sent_at": string | null,
"allow_removal_requests": boolean,
"billing_status": string,
"created_at": string,
"created_by": string | null,
"description": string | null,
"ends_on": string | null,
"grace_period_enabled": boolean,
"handle": string,
"id": string,
"logo_path": string | null,
"name": string,
"organisation": string | null,
"paid_at": string | null,
"roster_mapping": Json | null,
"starts_on": string | null,
"status": string,
"stripe_checkout_session_id": string | null,
"stripe_customer_id": string | null,
"stripe_subscription_id": string | null,
"updated_at": string,
"venue": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "events"
        isOneToOne: true
        isSetofReturn: false
      } },
"seed_event_roles":
{ Args: { "p_event_id": string }; Returns: undefined
                           },
"touch_event_visit":
{ Args: { "p_event_id": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const


export type EventRecord = Tables<"events">;
export type EventRole = Tables<"event_roles">;
export type Membership = Tables<"memberships">;
export type Album = Tables<"albums">;
export type Media = Tables<"media">;
export type GuestLink = Tables<"album_guest_links">;
export type RemovalRequest = Tables<"media_removal_requests">;

export type MembershipStatus = "pending" | "active" | "grace" | "revoked";
export type MembershipRole = "event_admin" | "event_member";
export type MediaKind = "photo" | "video";
export type AccessMode = "link" | "guest_list";
export type EventFaceSettings = Tables<"event_face_settings">;
export type MediaFace = Tables<"media_faces">;
export type MemberFaceProfile = Tables<"member_face_profiles">;
export type FaceMatch = Tables<"face_matches">;
export type FaceJob = Tables<"face_jobs">;

export type FaceMatchState = "confirmed" | "suggested" | "rejected";
export type FaceJobKind = "index_media" | "rematch_media" | "enrol_profile";
export type FaceProfileStatus = "pending" | "ready" | "failed";
