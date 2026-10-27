
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
            "fridge_members": {
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
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
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
"delete_ingredient":
{ Args: { "expected_version": number,"ingredient_id": string,"target_fridge_id": string }; Returns: undefined
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
