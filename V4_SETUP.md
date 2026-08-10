# VYNTRO V4 — Auth setup

V4 removes demo accounts and manual SteamID entry.

## What V4 uses
- Supabase Auth for email/password sign-up and sign-in.
- Steam OpenID 2.0 via Supabase Edge Functions for Steam sign-in/linking.
- A `profiles` table protected by Row Level Security.
- A `missions` table protected by Row Level Security.
- OpenDota only after a SteamID has been verified by Steam.

## Required Supabase setup
1. Create/open a Supabase project.
2. Run `supabase/schema.sql` in SQL Editor.
3. Deploy `steam-login` and `steam-callback` from `supabase/functions/`.
4. Set `SITE_URL=https://hvhuser1234.github.io/vyntro/` for Edge Functions.
5. In Auth → URL Configuration set Site URL to `https://hvhuser1234.github.io/vyntro/` and add it to Redirect URLs.
6. Put the project's **Project URL** and **Publishable/anon key** into the frontend V4 config.

Never put `service_role` in GitHub Pages or browser JavaScript.

## Important Dota limitation
Steam authentication proves the user's SteamID, but it does not bypass Dota/Steam privacy. If public match history is disabled or unavailable, VYNTRO must show that the statistics cannot be loaded rather than substituting demo data.
