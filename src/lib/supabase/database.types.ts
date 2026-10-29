
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
            "fridge_invites": {
                  Row: {
                    "created_at": string,"created_by": string,"expires_at": string,"fridge_id": string,"id": string,"revoked_at": string | null,"token_hash": string,"used_at": string | null,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": string,"created_by": string,"expires_at": string,"fridge_id": string,"id"?: string,"revoked_at"?: string | null,"token_hash": string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string,"fridge_id"?: string,"id"?: string,"revoked_at"?: string | null,"token_hash"?: string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fridge_invites_fridge_id_fkey"
      columns: ["fridge_id"]
isOneToOne: false
      referencedRelation: "fridges"
      referencedColumns: ["id"]
    }
                  ]
                },"fridge_members": {
                  Row: {
                    "fridge_id": string,"joined_at": string,"role": Database["public"]['Enums']["fridge_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "fridge_id": string,"joined_at"?: string,"role"?: Database["public"]['Enums']["fridge_role"],"user_id": string
                  }
                  Update: {
                    "fridge_id"?: string,"joined_at"?: string,"role"?: Database["public"]['Enums']["fridge_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fridge_members_fridge_id_fkey"
      columns: ["fridge_id"]
isOneToOne: false
      referencedRelation: "fridges"
      referencedColumns: ["id"]
    }
                  ]
                },"fridges": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"owner_user_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name"?: string,"owner_user_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"owner_user_id"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"ingredient_create_requests": {
                  Row: {
                    "created_at": string,"fridge_id": string,"ingredient_id": string,"payload": NonNullable<Json>,"request_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"fridge_id": string,"ingredient_id": string,"payload": NonNullable<Json>,"request_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"fridge_id"?: string,"ingredient_id"?: string,"payload"?: NonNullable<Json>,"request_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingredient_create_requests_fridge_id_fkey"
      columns: ["fridge_id"]
isOneToOne: false
      referencedRelation: "fridges"
      referencedColumns: ["id"]
    }
                  ]
                },"ingredients": {
                  Row: {
                    "created_at": string,"created_by": string,"expires_on": string,"fridge_id": string,"id": string,"name": string,"normalized_name": string | null,"remaining_percent": number,"storage": string,"updated_at": string,"updated_by": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"expires_on": string,"fridge_id": string,"id"?: string,"name": string,"normalized_name"?: never,"remaining_percent"?: number,"storage": string,"updated_at"?: string,"updated_by": string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"expires_on"?: string,"fridge_id"?: string,"id"?: string,"name"?: string,"normalized_name"?: never,"remaining_percent"?: number,"storage"?: string,"updated_at"?: string,"updated_by"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingredients_fridge_id_fkey"
      columns: ["fridge_id"]
isOneToOne: false
      referencedRelation: "fridges"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_deliveries": {
                  Row: {
                    "created_at": string,"job_id": string,"status": string,"subscription_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"job_id": string,"status": string,"subscription_id": string
                  }
                  Update: {
                    "created_at"?: string,"job_id"?: string,"status"?: string,"subscription_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_deliveries_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "notification_jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_jobs": {
                  Row: {
                    "attempts": number,"due_at": string,"id": string,"lease_token": string | null,"lease_until": string | null,"local_date": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"due_at": string,"id"?: string,"lease_token"?: string | null,"lease_until"?: string | null,"local_date": string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "attempts"?: number,"due_at"?: string,"id"?: string,"lease_token"?: string | null,"lease_until"?: string | null,"local_date"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"notification_preferences": {
                  Row: {
                    "enabled": boolean,"last_sent_local_date": string | null,"local_time": string,"next_run_at": string | null,"timezone": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled"?: boolean,"last_sent_local_date"?: string | null,"local_time"?: string,"next_run_at"?: string | null,"timezone"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "enabled"?: boolean,"last_sent_local_date"?: string | null,"local_time"?: string,"next_run_at"?: string | null,"timezone"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"last_fridge_id": string | null,"theme_preference": string,"timezone": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"last_fridge_id"?: string | null,"theme_preference"?: string,"timezone"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"last_fridge_id"?: string | null,"theme_preference"?: string,"timezone"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_last_fridge_id_fkey"
      columns: ["last_fridge_id"]
isOneToOne: false
      referencedRelation: "fridges"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"receipt_drafts": {
                  Row: {
                    "analysis_run": string | null,"analysis_started_at": string | null,"cleanup_pending": boolean,"commit_payload": Json | null,"commit_result": Json | null,"created_at": string,"error_code": string | null,"expires_at": string,"fridge_id": string,"id": string,"items": NonNullable<Json>,"object_path": string,"request_id": string | null,"review_items": Json | null,"staged_object_path": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "analysis_run"?: string | null,"analysis_started_at"?: string | null,"cleanup_pending"?: boolean,"commit_payload"?: Json | null,"commit_result"?: Json | null,"created_at"?: string,"error_code"?: string | null,"expires_at"?: string,"fridge_id": string,"id": string,"items"?: NonNullable<Json>,"object_path": string,"request_id"?: string | null,"review_items"?: Json | null,"staged_object_path"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "analysis_run"?: string | null,"analysis_started_at"?: string | null,"cleanup_pending"?: boolean,"commit_payload"?: Json | null,"commit_result"?: Json | null,"created_at"?: string,"error_code"?: string | null,"expires_at"?: string,"fridge_id"?: string,"id"?: string,"items"?: NonNullable<Json>,"object_path"?: string,"request_id"?: string | null,"review_items"?: Json | null,"staged_object_path"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "receipt_drafts_fridge_id_fkey"
      columns: ["fridge_id"]
isOneToOne: false
      referencedRelation: "fridges"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_fridge_invite":
{ Args: { "token_digest": string }; Returns: {
              "id": string,"name": string,"role": Database["public"]['Enums']["fridge_role"]
            }[]
                           },
"cancel_receipt":
{ Args: { "draft_id": string }; Returns: undefined
                           },
"claim_notification_jobs":
{ Args: { "at_time": string,"batch_limit": number }; Returns: {
              "attempts": number,
"due_at": string,
"id": string,
"lease_token": string | null,
"lease_until": string | null,
"local_date": string,
"status": string,
"user_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "notification_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"commit_receipt":
{ Args: { "commit_request": string,"confirmed_items": Json,"draft_id": string }; Returns: Json
                           },
"create_fridge_invite":
{ Args: { "target_fridge_id": string,"token_digest": string }; Returns: {
              "expires_at": string,"invite_id": string
            }[]
                           },
"create_ingredient":
{ Args: { "input": Json,"target_fridge_id": string }; Returns: {
              "created_at": string,
"created_by": string,
"expires_on": string,
"fridge_id": string,
"id": string,
"name": string,
"normalized_name": string | null,
"remaining_percent": number,
"storage": string,
"updated_at": string,
"updated_by": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "ingredients"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_receipt_draft":
{ Args: { "draft_id": string,"target_fridge_id": string }; Returns: {
              "analysis_run": string | null,
"analysis_started_at": string | null,
"cleanup_pending": boolean,
"commit_payload": Json | null,
"commit_result": Json | null,
"created_at": string,
"error_code": string | null,
"expires_at": string,
"fridge_id": string,
"id": string,
"items": NonNullable<Json>,
"object_path": string,
"request_id": string | null,
"review_items": Json | null,
"staged_object_path": string | null,
"status": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "receipt_drafts"
        isOneToOne: true
        isSetofReturn: false
      } } |
{ Args: { "draft_id": string,"staged_upload_path": string,"target_fridge_id": string }; Returns: {
              "analysis_run": string | null,
"analysis_started_at": string | null,
"cleanup_pending": boolean,
"commit_payload": Json | null,
"commit_result": Json | null,
"created_at": string,
"error_code": string | null,
"expires_at": string,
"fridge_id": string,
"id": string,
"items": NonNullable<Json>,
"object_path": string,
"request_id": string | null,
"review_items": Json | null,
"staged_object_path": string | null,
"status": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "receipt_drafts"
        isOneToOne: true
        isSetofReturn: false
      } },
"delete_ingredient":
{ Args: { "expected_version": number,"ingredient_id": string,"target_fridge_id": string }; Returns: undefined
                           },
"delete_push_subscription":
{ Args: { "subscription_id": string }; Returns: undefined
                           },
"expire_receipts":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"finish_notification_job":
{ Args: { "job_id": string,"token": string,"will_retry": boolean }; Returns: undefined
                           },
"finish_receipt_analysis":
{ Args: { "draft_id": string,"extracted": Json,"run_id": string,"succeeded": boolean }; Returns: boolean
                           },
"inspect_fridge_invite":
{ Args: { "token_digest": string }; Returns: {
              "fridge_id": string,"fridge_name": string,"role": Database["public"]['Enums']["fridge_role"],"state": string
            }[]
                           },
"leave_fridge":
{ Args: { "target_fridge_id": string }; Returns: undefined
                           },
"list_fridge_members":
{ Args: { "target_fridge_id": string }; Returns: {
              "display_name": string,"role": Database["public"]['Enums']["fridge_role"],"user_id": string
            }[]
                           },
"prepare_notification_dispatch":
{ Args: { "job_id": string,"token": string }; Returns: Json
                           },
"read_notification_digest":
{ Args: { "digest_id": string }; Returns: Json
                           },
"record_notification_delivery":
{ Args: { "delivery_status": string,"job_id": string,"subscription_id": string,"token": string }; Returns: undefined
                           },
"recover_receipt_analysis":
{ Args: { "draft_id": string }; Returns: boolean
                           },
"remove_fridge_member":
{ Args: { "member_user_id": string,"target_fridge_id": string }; Returns: undefined
                           },
"revoke_fridge_invite":
{ Args: { "invite_id": string,"target_fridge_id": string }; Returns: undefined
                           },
"save_notification_preferences":
{ Args: { "input": Json }; Returns: {
              "enabled": boolean,
"last_sent_local_date": string | null,
"local_time": string,
"next_run_at": string | null,
"timezone": string,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "notification_preferences"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_push_subscription":
{ Args: { "input": Json }; Returns: string
                           },
"save_receipt_review":
{ Args: { "draft_id": string,"review": Json }; Returns: undefined
                           },
"start_receipt_analysis":
{ Args: { "draft_id": string }; Returns: string
                           },
"update_ingredient":
{ Args: { "expected_version": number,"ingredient_id": string,"patch": Json,"target_fridge_id": string }; Returns: {
              "created_at": string,
"created_by": string,
"expires_on": string,
"fridge_id": string,
"id": string,
"name": string,
"normalized_name": string | null,
"remaining_percent": number,
"storage": string,
"updated_at": string,
"updated_by": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "ingredients"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "fridge_role": "owner"|"member"
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
            "fridge_role": ["owner", "member"]
          }
        }
} as const
