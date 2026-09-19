export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Placeholder until `supabase gen types` is run against the MatComp project. */
export type Database = {
  public: {
    Tables: Record<string, unknown>;
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
  };
};
