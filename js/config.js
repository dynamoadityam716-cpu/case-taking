
  // ---- Supabase config (NEW standalone database) ---------------------------
  // ⚠️ This folder is FULLY SEPARATE from the base project. It points ONLY at
  // the new Supabase project you create — never at the base project's URL or
  // key, and the base folder is never edited.
  //
  // 1. Create a brand-new project at https://supabase.com (different name
  //    from the base project) and save its database password.
  // 2. Open the new project → SQL editor → run the whole of sql/schema.sql,
  //    then sql/seed_dev.sql (swap doctor@example.com for your auth email).
  // 3. Paste the NEW project's Project URL and anon public key below
  //    (Project Settings → API).
  //
  // Until you paste real values the app runs in session-only mode (dbEnabled
  // = false) and shows "account system is not configured" at login — that is
  // intentional so this copy can never silently fall back to the base DB.
  const SUPABASE_URL = 'https://ltktvczyvunjfeqxdhmu.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0a3R2Y3p5dnVuamZlcXhkaG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDA0MDUsImV4cCI6MjEwNDE3NjQwNX0.fnlyUhwn1sXQqwtf_HVjwJj6gIgjpKRcQi87A7XS-zQ'
  const dbEnabled = !SUPABASE_URL.startsWith('YOUR_') && !SUPABASE_ANON_KEY.startsWith('YOUR_');
  const supabaseClient = dbEnabled ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
