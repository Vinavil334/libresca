export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string;
          updated_at: string;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          updated_at?: string;
          value: NonNullable<Json>;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      authors: {
        Row: {
          alternate_names: string[];
          created_at: string;
          created_by: string | null;
          id: string;
          merged_into: string | null;
          name: string;
          sort_name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          alternate_names?: string[];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          merged_into?: string | null;
          name: string;
          sort_name: string;
          updated_at?: string;
        };
        Update: {
          alternate_names?: string[];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          merged_into?: string | null;
          name?: string;
          sort_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'authors_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'authors_merged_into_fkey';
            columns: ['merged_into'];
            isOneToOne: false;
            referencedRelation: 'authors';
            referencedColumns: ['id'];
          },
        ];
      };
      contributors: {
        Row: {
          edition_id: string;
          id: string;
          name: string;
          position: number;
          role: Database['public']['Enums']['contributor_role'];
        };
        ComputedFields: never;
        Insert: {
          edition_id: string;
          id?: string;
          name: string;
          position?: number;
          role: Database['public']['Enums']['contributor_role'];
        };
        Update: {
          edition_id?: string;
          id?: string;
          name?: string;
          position?: number;
          role?: Database['public']['Enums']['contributor_role'];
        };
        Relationships: [
          {
            foreignKeyName: 'contributors_edition_id_fkey';
            columns: ['edition_id'];
            isOneToOne: false;
            referencedRelation: 'editions';
            referencedColumns: ['id'];
          },
        ];
      };
      copies: {
        Row: {
          acquired_on: string | null;
          created_at: string;
          edition_id: string;
          id: string;
          is_lendable: boolean;
          notes: string | null;
          owner_id: string;
          updated_at: string;
          visibility: Database['public']['Enums']['visibility'];
        };
        ComputedFields: never;
        Insert: {
          acquired_on?: string | null;
          created_at?: string;
          edition_id: string;
          id?: string;
          is_lendable?: boolean;
          notes?: string | null;
          owner_id?: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['visibility'];
        };
        Update: {
          acquired_on?: string | null;
          created_at?: string;
          edition_id?: string;
          id?: string;
          is_lendable?: boolean;
          notes?: string | null;
          owner_id?: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'copies_edition_id_fkey';
            columns: ['edition_id'];
            isOneToOne: false;
            referencedRelation: 'editions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'copies_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      editions: {
        Row: {
          cover_id: string | null;
          cover_path: string | null;
          cover_source: Database['public']['Enums']['cover_source'] | null;
          created_at: string;
          created_by: string | null;
          field_sources: NonNullable<Json>;
          format: Database['public']['Enums']['edition_format'] | null;
          id: string;
          isbn13: string | null;
          language: string | null;
          metadata_status: Database['public']['Enums']['metadata_status'];
          page_count: number | null;
          published_year: number | null;
          publisher: string | null;
          title: string;
          updated_at: string;
          work_id: string;
        };
        ComputedFields: never;
        Insert: {
          cover_id?: string | null;
          cover_path?: string | null;
          cover_source?: Database['public']['Enums']['cover_source'] | null;
          created_at?: string;
          created_by?: string | null;
          field_sources?: NonNullable<Json>;
          format?: Database['public']['Enums']['edition_format'] | null;
          id?: string;
          isbn13?: string | null;
          language?: string | null;
          metadata_status?: Database['public']['Enums']['metadata_status'];
          page_count?: number | null;
          published_year?: number | null;
          publisher?: string | null;
          title: string;
          updated_at?: string;
          work_id: string;
        };
        Update: {
          cover_id?: string | null;
          cover_path?: string | null;
          cover_source?: Database['public']['Enums']['cover_source'] | null;
          created_at?: string;
          created_by?: string | null;
          field_sources?: NonNullable<Json>;
          format?: Database['public']['Enums']['edition_format'] | null;
          id?: string;
          isbn13?: string | null;
          language?: string | null;
          metadata_status?: Database['public']['Enums']['metadata_status'];
          page_count?: number | null;
          published_year?: number | null;
          publisher?: string | null;
          title?: string;
          updated_at?: string;
          work_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'editions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'editions_work_id_fkey';
            columns: ['work_id'];
            isOneToOne: false;
            referencedRelation: 'works';
            referencedColumns: ['id'];
          },
        ];
      };
      external_ids: {
        Row: {
          author_id: string | null;
          created_at: string;
          edition_id: string | null;
          id: string;
          raw: Json | null;
          source: Database['public']['Enums']['metadata_source'];
          value: string;
          work_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          created_at?: string;
          edition_id?: string | null;
          id?: string;
          raw?: Json | null;
          source: Database['public']['Enums']['metadata_source'];
          value: string;
          work_id?: string | null;
        };
        Update: {
          author_id?: string | null;
          created_at?: string;
          edition_id?: string | null;
          id?: string;
          raw?: Json | null;
          source?: Database['public']['Enums']['metadata_source'];
          value?: string;
          work_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'external_ids_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'authors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'external_ids_edition_id_fkey';
            columns: ['edition_id'];
            isOneToOne: false;
            referencedRelation: 'editions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'external_ids_work_id_fkey';
            columns: ['work_id'];
            isOneToOne: false;
            referencedRelation: 'works';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_creature: string | null;
          created_at: string;
          display_name: string;
          handle: string | null;
          id: string;
          locale: string;
          status: Database['public']['Enums']['profile_status'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_creature?: string | null;
          created_at?: string;
          display_name: string;
          handle?: string | null;
          id: string;
          locale?: string;
          status?: Database['public']['Enums']['profile_status'];
          updated_at?: string;
        };
        Update: {
          avatar_creature?: string | null;
          created_at?: string;
          display_name?: string;
          handle?: string | null;
          id?: string;
          locale?: string;
          status?: Database['public']['Enums']['profile_status'];
          updated_at?: string;
        };
        Relationships: [];
      };
      readings: {
        Row: {
          created_at: string;
          edition_id: string | null;
          finished_on: string | null;
          id: string;
          rating_half: number | null;
          review: string | null;
          started_on: string | null;
          status: Database['public']['Enums']['reading_status'];
          updated_at: string;
          user_id: string;
          visibility: Database['public']['Enums']['visibility'];
          work_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          edition_id?: string | null;
          finished_on?: string | null;
          id?: string;
          rating_half?: number | null;
          review?: string | null;
          started_on?: string | null;
          status: Database['public']['Enums']['reading_status'];
          updated_at?: string;
          user_id?: string;
          visibility?: Database['public']['Enums']['visibility'];
          work_id: string;
        };
        Update: {
          created_at?: string;
          edition_id?: string | null;
          finished_on?: string | null;
          id?: string;
          rating_half?: number | null;
          review?: string | null;
          started_on?: string | null;
          status?: Database['public']['Enums']['reading_status'];
          updated_at?: string;
          user_id?: string;
          visibility?: Database['public']['Enums']['visibility'];
          work_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'readings_edition_id_fkey';
            columns: ['edition_id'];
            isOneToOne: false;
            referencedRelation: 'editions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'readings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'readings_work_id_fkey';
            columns: ['work_id'];
            isOneToOne: false;
            referencedRelation: 'works';
            referencedColumns: ['id'];
          },
        ];
      };
      work_authors: {
        Row: {
          author_id: string;
          position: number;
          work_id: string;
        };
        ComputedFields: never;
        Insert: {
          author_id: string;
          position: number;
          work_id: string;
        };
        Update: {
          author_id?: string;
          position?: number;
          work_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'work_authors_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'authors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'work_authors_work_id_fkey';
            columns: ['work_id'];
            isOneToOne: false;
            referencedRelation: 'works';
            referencedColumns: ['id'];
          },
        ];
      };
      works: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          field_sources: NonNullable<Json>;
          first_published_year: number | null;
          id: string;
          merged_into: string | null;
          original_language: string | null;
          original_title: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          field_sources?: NonNullable<Json>;
          first_published_year?: number | null;
          id?: string;
          merged_into?: string | null;
          original_language?: string | null;
          original_title?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          field_sources?: NonNullable<Json>;
          first_published_year?: number | null;
          id?: string;
          merged_into?: string | null;
          original_language?: string | null;
          original_title?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'works_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'works_merged_into_fkey';
            columns: ['merged_into'];
            isOneToOne: false;
            referencedRelation: 'works';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_edition: { Args: { entry: Json }; Returns: Json };
      health_check: { Args: Record<PropertyKey, never>; Returns: boolean };
      search_works: {
        Args: { max_results?: number; query: string };
        Returns: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          field_sources: NonNullable<Json>;
          first_published_year: number | null;
          id: string;
          merged_into: string | null;
          original_language: string | null;
          original_title: string | null;
          title: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'works';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
    };
    Enums: {
      contributor_role: 'translator' | 'editor' | 'illustrator' | 'introduction' | 'other';
      cover_source: 'openlibrary' | 'googlebooks' | 'upload' | 'generated';
      edition_format: 'hardcover' | 'paperback' | 'ebook' | 'audiobook' | 'other';
      metadata_source: 'openlibrary' | 'googlebooks' | 'sbn' | 'goodreads' | 'user';
      metadata_status: 'incomplete' | 'complete';
      profile_status: 'pending' | 'active' | 'suspended';
      reading_status: 'want' | 'reading' | 'read' | 'abandoned';
      visibility: 'private' | 'friends' | 'public';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      contributor_role: ['translator', 'editor', 'illustrator', 'introduction', 'other'],
      cover_source: ['openlibrary', 'googlebooks', 'upload', 'generated'],
      edition_format: ['hardcover', 'paperback', 'ebook', 'audiobook', 'other'],
      metadata_source: ['openlibrary', 'googlebooks', 'sbn', 'goodreads', 'user'],
      metadata_status: ['incomplete', 'complete'],
      profile_status: ['pending', 'active', 'suspended'],
      reading_status: ['want', 'reading', 'read', 'abandoned'],
      visibility: ['private', 'friends', 'public'],
    },
  },
} as const;
