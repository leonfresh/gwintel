<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1inRyttZ_4ZqOx_z976amoj1x2-UQDY3v

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Add your Supabase env vars in `.env.local` (see [.env.local.example](.env.local.example)):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Create the database tables in Supabase:
   - Run the SQL in [supabase/schema.sql](supabase/schema.sql)
3. Run the app (Next.js):
   `npm run dev`

## Supabase Login

- Visit `/login` to sign in via Supabase Auth.

## Posting & Voting

- Adding new posts or voting requires:
   - being signed in, and
   - verifying your email (Supabase email confirmation).
