================================================================================
 genjutsu — Supabase Database Setup Guide
================================================================================

This guide provides a step-by-step process for setting up a fresh Supabase 
project for the genjutsu application.


FILES
-----

  init.sql        → Single file to set up the entire database.
                    Includes all tables, RLS policies, RPCs, and cron jobs.

  migrations/     → Individual migration files (historical record).
                    Not needed for a fresh setup but kept for reference.


FRESH SETUP (STEP-BY-STEP)
--------------------------

  1. CREATE PROJECT
     Create a new project at https://supabase.com.

  2. ENABLE EXTENSIONS
     In the Supabase Dashboard, go to Database → Extensions and enable:
     - pg_net (Required for automated storage cleanup)
     - pg_cron (Required for 24h expiration)

  3. RUN INIT SQL
     Go to the SQL Editor, create a new query, paste the entire contents 
     of init.sql, and run it.

  4. CONFIGURE STORAGE BUCKETS
     Go to Storage and create the following buckets (set them to PUBLIC):
     - post-media    (For post images/videos)
     - avatars       (For profile pictures)
     - banners       (For profile banners)

  5. SETUP SERVICE ROLE KEY (CRITICAL FOR AUTO-CLEANUP)
     This is required for the 24h cleanup job to delete files from storage.
     
     a. Go to Settings → API.
     b. Copy the "service_role" secret key (NOT the anon key).
     c. Go to SQL Editor and run this command:
        
        SELECT vault.create_secret('supabase_service_role_key', 'YOUR_SERVICE_ROLE_KEY');

  6. UPDATE PROJECT ID (AUTO-CLEANUP)
     In init.sql, search for 'scvikrxfxijqoedfryvx' (the project ID).
     Replace it with your own project ID found in your Supabase URL.

  7. SETUP ADMIN USER (OPTIONAL)
     To grant admin access, find your user ID in the Auth section and run:
     
     INSERT INTO public.admin_users (user_id)
     VALUES ('YOUR_AUTH_USERS_ID_HERE');


HOW EXPIRATION WORKS
--------------------

  Everything in genjutsu is ephemeral (lasts only 24 hours):
  
  - Posts & Media: Auto-deleted after 24 hours.
  - Whispers (DMs): Auto-deleted after 24 hours.
  - Follow Notifications: Auto-deleted after 24 hours.
  - Storage Files: Cleaned up automatically when posts expire.

  Cron jobs are scheduled in init.sql to run these cleanups every hour.


CLIENT SETUP
------------

  Update your .env file in the project root:

    VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
    VITE_SUPABASE_PUBLISHABLE_KEY="YOUR_ANON_KEY"


SECURITY REMINDER
-----------------

  - Your service_role key is stored safely in the Vault and is NEVER 
    exposed to the frontend.
  - Never share or commit your service_role key.
================================================================================
