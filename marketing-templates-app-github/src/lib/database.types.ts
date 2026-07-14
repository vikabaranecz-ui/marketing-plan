export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      app_states: {
        Row: {
          created_at: string;
          state: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          state?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          state?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      shared_plans: {
        Row: { archived: boolean; created_at: string; id: string; last_edited_by: string | null; owner_id: string; source_plan_id: string; tasks: Json; team_id: string; template: Json; title: string; updated_at: string };
        Insert: { archived?: boolean; created_at?: string; id?: string; last_edited_by?: string | null; owner_id: string; source_plan_id: string; tasks?: Json; team_id: string; template: Json; title: string; updated_at?: string };
        Update: { archived?: boolean; created_at?: string; id?: string; last_edited_by?: string | null; owner_id?: string; source_plan_id?: string; tasks?: Json; team_id?: string; template?: Json; title?: string; updated_at?: string };
        Relationships: [];
      };
      team_members: {
        Row: { created_at: string; display_name: string; email: string; role: string; team_id: string; user_id: string };
        Insert: { created_at?: string; display_name?: string; email: string; role?: string; team_id: string; user_id: string };
        Update: { created_at?: string; display_name?: string; email?: string; role?: string; team_id?: string; user_id?: string };
        Relationships: [];
      };
      teams: {
        Row: { created_at: string; id: string; name: string; owner_id: string; updated_at: string };
        Insert: { created_at?: string; id?: string; name: string; owner_id: string; updated_at?: string };
        Update: { created_at?: string; id?: string; name?: string; owner_id?: string; updated_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_team: { Args: { team_name: string }; Returns: string };
      add_team_member_by_email: { Args: { target_team_id: string; target_email: string; target_role?: string }; Returns: Database['public']['Tables']['team_members']['Row'] };
      remove_team_member: { Args: { target_team_id: string; target_user_id: string }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
