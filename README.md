# VYNTRO V2 — Dota 2 Growth MVP

Static prototype that can be hosted on GitHub Pages, Netlify, Cloudflare Pages, or any static host.

## What works
- Responsive landing/dashboard/matches/improve/challenges/profile/AI coach UI.
- Demo mode works offline except for Google Fonts.
- Public Dota profile import using OpenDota API directly from the browser.
- Accepts Dota/OpenDota Account ID or SteamID64 (converted client-side).
- Imports up to 20 recent public matches.
- Calculates a transparent V1 Skill DNA from measurable public stats only.
- Generates a measurable mission from the weakest score.
- Match reports with evidence cards.
- Local mission/challenge state via localStorage.
- Shareable URL using `?account=<account_id>#profile`.

## Important V1 limitations
- No real Steam authentication yet.
- No private match data.
- OpenDota rate limits/availability apply.
- Skill scores are an MVP heuristic, not a claim of true player skill.
- No replay parser yet, so map awareness/positioning are intentionally not scored.
- AI Coach is local rule-based prototype; no LLM API is embedded in the public static site.

## Run
Open `index.html` directly, or serve the folder as a static site.
