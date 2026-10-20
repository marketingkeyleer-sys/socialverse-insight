// Hand-maintained to match supabase/migrations/001_initial_schema.sql exactly.
//
// Table keys are sv_-prefixed because this Supabase project is shared with
// another, unrelated app that already owns the unprefixed table names.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PlanTier = "free" | "pro" | "business";
export type Platform = "facebook" | "instagram" | "youtube" | "linkedin" | "linkedin_page" | "whatsapp";

// Per-post WhatsApp delivery settings — which approved template to send and
// to which audience. Mirrors WhatsAppOptions in supabase/functions/_shared/whatsapp.ts.
// A number is connected one of two ways: the official Cloud API ("cloud",
// template messages to opted-in contacts) or the user's own QR-linked bridge
// ("bridge", free-form posts to contacts and groups). Cloud posts use the
// template fields; bridge posts use the audience fields.
export type WhatsAppMode = "cloud" | "bridge";
export type BridgePace = "safe" | "balanced" | "fast";

export interface WhatsAppOptions {
  templateName?: string;
  language?: string;
  headerFormat?: "IMAGE" | "VIDEO" | null;
  bodyParamCount?: 0 | 1;
  tag?: string | null;
  includeContacts?: boolean;
  groups?: { id: string; name: string }[];
  pace?: BridgePace;
}

export type WhatsAppBroadcastStatus = "sending" | "completed" | "partial" | "failed";
export type WhatsAppRecipientStatus = "pending" | "queued" | "sent" | "delivered" | "read" | "failed";
export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "partially_failed" | "failed";
export type PlatformResultStatus = "pending" | "publishing" | "published" | "failed";
export type AdStatus = "draft" | "active" | "paused" | "completed" | "failed";
export type AdObjective = "OUTCOME_AWARENESS" | "OUTCOME_ENGAGEMENT" | "OUTCOME_TRAFFIC" | "OUTCOME_LEADS" | "OUTCOME_SALES";

export interface Database {
  public: {
    Tables: {
      sv_inbox_state: {
        Row: { id: string; user_id: string; connected_account_id: string; conversation_id: string; is_read: boolean | null; read_updated_at: string | null; note: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["sv_inbox_state"]["Row"]> & { user_id: string; connected_account_id: string; conversation_id: string };
        Update: Partial<Database["public"]["Tables"]["sv_inbox_state"]["Row"]>;
        Relationships: [];
      };
      sv_brands: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sv_brands"]["Row"]> & { user_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["sv_brands"]["Row"]>;
        Relationships: [];
      };
      sv_profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string;
          avatar_url: string | null;
          plan_tier: PlanTier;
          max_connected_accounts: number;
          max_scheduled_posts: number;
          timezone: string;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sv_profiles"]["Row"]> & { id: string; email: string };
        Update: Partial<Database["public"]["Tables"]["sv_profiles"]["Row"]>;
        Relationships: [];
      };
      sv_connected_accounts: {
        Row: {
          id: string;
          user_id: string;
          platform: Platform;
          platform_user_id: string | null;
          platform_username: string | null;
          platform_display_name: string | null;
          access_token_ciphertext: string | null;
          refresh_token_ciphertext: string | null;
          token_iv: string | null;
          refresh_iv: string | null;
          page_access_token_ciphertext: string | null;
          page_access_token_iv: string | null;
          token_expires_at: string | null;
          scopes: string[] | null;
          is_active: boolean;
          profile_picture_url: string | null;
          followers_count: number;
          following_count: number;
          posts_count: number;
          connected_at: string;
          last_synced_at: string | null;
          sync_interval_minutes: number;
          updated_at: string;
          brand_id: string | null;
          metadata: {
            mode?: WhatsAppMode;
            waba_id?: string;
            quality_rating?: string | null;
            bridge_url?: string;
          } & Record<string, Json | undefined>;
        };
        Insert: Partial<Database["public"]["Tables"]["sv_connected_accounts"]["Row"]> & {
          user_id: string;
          platform: Platform;
        };
        Update: Partial<Database["public"]["Tables"]["sv_connected_accounts"]["Row"]>;
        Relationships: [];
      };
      sv_posts: {
        Row: {
          id: string;
          user_id: string;
          brand_id: string | null;
          platform_content: Partial<Record<Platform, { content: string; title?: string; media_urls?: string[] }>>;
          title: string | null;
          content: string;
          media_urls: string[] | null;
          platforms: Platform[];
          connected_account_ids: string[] | null;
          status: PostStatus;
          scheduled_at: string | null;
          published_at: string | null;
          tags: string[] | null;
          whatsapp_options: WhatsAppOptions | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sv_posts"]["Row"]> & { user_id: string; content: string };
        Update: Partial<Database["public"]["Tables"]["sv_posts"]["Row"]>;
        Relationships: [];
      };
      sv_post_platform_results: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          connected_account_id: string | null;
          platform: Platform;
          status: PlatformResultStatus;
          platform_post_id: string | null;
          published_url: string | null;
          error_message: string | null;
          engagement_data: Json;
          published_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sv_post_platform_results"]["Row"]> & {
          post_id: string;
          user_id: string;
          platform: Platform;
        };
        Update: Partial<Database["public"]["Tables"]["sv_post_platform_results"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "sv_post_platform_results_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "sv_posts";
            referencedColumns: ["id"];
          },
        ];
      };
      sv_analytics_snapshots: {
        Row: {
          id: string;
          user_id: string;
          connected_account_id: string;
          platform: Platform;
          metric_date: string;
          followers: number;
          following: number;
          impressions: number;
          reach: number;
          engagement_rate: number;
          likes: number;
          comments: number;
          shares: number;
          saves: number;
          clicks: number;
          profile_views: number;
          video_views: number;
          fetched_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sv_analytics_snapshots"]["Row"]> & {
          user_id: string;
          connected_account_id: string;
          platform: Platform;
          metric_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["sv_analytics_snapshots"]["Row"]>;
        Relationships: [];
      };
      sv_platform_posts: {
        Row: {
          id: string;
          user_id: string;
          connected_account_id: string;
          platform: Platform;
          platform_post_id: string;
          message: string | null;
          media_url: string | null;
          permalink_url: string | null;
          posted_at: string;
          likes_count: number;
          comments_count: number;
          shares_count: number;
          impressions: number | null;
          reach: number | null;
          views_count: number | null;
          media_type: string | null;
          fetched_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sv_platform_posts"]["Row"]> & {
          user_id: string;
          connected_account_id: string;
          platform: Platform;
          platform_post_id: string;
          posted_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["sv_platform_posts"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "sv_platform_posts_connected_account_id_fkey";
            columns: ["connected_account_id"];
            isOneToOne: false;
            referencedRelation: "sv_connected_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      sv_ad_accounts: {
        Row: {
          id: string;
          user_id: string;
          connected_account_id: string;
          meta_ad_account_id: string;
          name: string | null;
          currency: string | null;
          account_status: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sv_ad_accounts"]["Row"]> & {
          user_id: string;
          connected_account_id: string;
          meta_ad_account_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["sv_ad_accounts"]["Row"]>;
        Relationships: [];
      };
      sv_ad_campaigns: {
        Row: {
          id: string;
          user_id: string;
          ad_account_id: string;
          name: string;
          objective: AdObjective;
          status: AdStatus;
          meta_campaign_id: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sv_ad_campaigns"]["Row"]> & {
          user_id: string;
          ad_account_id: string;
          name: string;
          objective: AdObjective;
        };
        Update: Partial<Database["public"]["Tables"]["sv_ad_campaigns"]["Row"]>;
        Relationships: [];
      };
      sv_ad_sets: {
        Row: {
          id: string;
          user_id: string;
          campaign_id: string;
          name: string;
          daily_budget_cents: number;
          start_time: string;
          end_time: string | null;
          targeting: Json;
          status: AdStatus;
          meta_adset_id: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sv_ad_sets"]["Row"]> & {
          user_id: string;
          campaign_id: string;
          name: string;
          daily_budget_cents: number;
        };
        Update: Partial<Database["public"]["Tables"]["sv_ad_sets"]["Row"]>;
        Relationships: [];
      };
      sv_ads: {
        Row: {
          id: string;
          user_id: string;
          ad_set_id: string;
          name: string;
          post_id: string | null;
          headline: string | null;
          body: string | null;
          media_url: string | null;
          destination_url: string | null;
          call_to_action: string | null;
          status: AdStatus;
          meta_ad_id: string | null;
          error_message: string | null;
          spend_cents: number | null;
          impressions: number | null;
          clicks: number | null;
          reach: number | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sv_ads"]["Row"]> & { user_id: string; ad_set_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["sv_ads"]["Row"]>;
        Relationships: [];
      };
      sv_whatsapp_contacts: {
        Row: {
          id: string;
          user_id: string;
          connected_account_id: string;
          phone: string;
          name: string | null;
          tags: string[];
          opted_in: boolean;
          opted_in_at: string | null;
          opt_in_source: string | null;
          opted_out_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sv_whatsapp_contacts"]["Row"]> & {
          user_id: string;
          connected_account_id: string;
          phone: string;
        };
        Update: Partial<Database["public"]["Tables"]["sv_whatsapp_contacts"]["Row"]>;
        Relationships: [];
      };
      sv_whatsapp_broadcasts: {
        Row: {
          id: string;
          user_id: string;
          connected_account_id: string;
          post_id: string | null;
          template_name: string | null;
          template_language: string | null;
          header_format: string | null;
          body_param_count: number;
          message_text: string;
          media_url: string | null;
          audience_tag: string | null;
          status: WhatsAppBroadcastStatus;
          total: number;
          mode: WhatsAppMode;
          bridge_pace: BridgePace | null;
          group_count: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sv_whatsapp_broadcasts"]["Row"]> & {
          user_id: string;
          connected_account_id: string;
          message_text: string;
        };
        Update: Partial<Database["public"]["Tables"]["sv_whatsapp_broadcasts"]["Row"]>;
        Relationships: [];
      };
      sv_whatsapp_recipients: {
        Row: {
          id: string;
          broadcast_id: string;
          user_id: string;
          contact_id: string | null;
          phone: string;
          status: WhatsAppRecipientStatus;
          wa_message_id: string | null;
          error_message: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sv_whatsapp_recipients"]["Row"]> & {
          broadcast_id: string;
          user_id: string;
          phone: string;
        };
        Update: Partial<Database["public"]["Tables"]["sv_whatsapp_recipients"]["Row"]>;
        Relationships: [];
      };
      sv_activity_log: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sv_activity_log"]["Row"]> & { user_id: string; action: string };
        Update: Partial<Database["public"]["Tables"]["sv_activity_log"]["Row"]>;
        Relationships: [];
      };
    };
    Views: {
      sv_whatsapp_broadcast_stats: {
        Row: {
          broadcast_id: string;
          pending: number;
          sent: number;
          delivered: number;
          read: number;
          failed: number;
          queued: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];

export type Brand = Tables<"sv_brands">;
export type Profile = Tables<"sv_profiles">;
export type ConnectedAccount = Tables<"sv_connected_accounts">;
export type Post = Tables<"sv_posts">;
export type PostPlatformResult = Tables<"sv_post_platform_results">;
export type AnalyticsSnapshot = Tables<"sv_analytics_snapshots">;
export type PlatformPost = Tables<"sv_platform_posts">;
export type ActivityLogEntry = Tables<"sv_activity_log">;
export type WhatsAppContact = Tables<"sv_whatsapp_contacts">;
export type WhatsAppBroadcast = Tables<"sv_whatsapp_broadcasts">;
export type WhatsAppRecipient = Tables<"sv_whatsapp_recipients">;
export type AdAccount = Tables<"sv_ad_accounts">;
export type AdCampaign = Tables<"sv_ad_campaigns">;
export type AdSet = Tables<"sv_ad_sets">;
export type Ad = Tables<"sv_ads">;
