# Handoff — things only Neil can do

Claude works through the phases on its own. This list is what it can't do itself.
Update it every session: tick done items, add new ones.

## Before / during Phase 1
- [ ] Connect the folder `C:\xampp\htdocs\mini system` to the new session (Claude reads the old code from it)

## Phase 3 (Supabase)
- [ ] Approve Claude creating a FREE Supabase project (it will ask once, through the Supabase connector)
- [ ] Optional: install the Supabase plugin from the plugin card (extra Supabase skills)

## Phase 6 (AI chatbot)
- [ ] Add your NEW Gemini key as a Supabase secret named `GEMINI_API_KEY`
      (Supabase dashboard → Project Settings → Edge Functions → Secrets). Never paste it in chat.

## Phase 5 (Google login)
- [ ] In Google Cloud Console, add the new app's URLs to your OAuth client
      (Claude will give you the exact URLs)

## Phase 8 (Deploy)
- [ ] Approve linking the GitHub repo to Vercel (Claude does the rest via the Vercel connector)

## Done
- [x] Created private repo `ramosneil/E-CFunds`
- [x] Gave Claude's GitHub App access to the repo
- [x] Created a new Gemini key
