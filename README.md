# OnePost — Upload Once. Post Everywhere.

A full PWA for publishing videos to YouTube, Instagram, 50+ Facebook Pages, multiple TikTok accounts, and X (Twitter) simultaneously.

## Features
- **Auto Video Editing** — FFmpeg auto-crop, resize, cut, captions (Whisper AI), highlight detection (Google Video AI)
- **Multi-Platform Publishing** — YouTube, Instagram Reels/Feed, 50+ Facebook Pages, multiple TikTok accounts, X/Twitter
- **Live Hashtag Manager** — Trending hashtags from X, TikTok, Google, Instagram, YouTube (Pakistan WOEID)
- **AI Hashtag Suggestions** — Claude API generates 15 relevant Pakistani political hashtags
- **Breaking News Alerts** — Monitors 8 Pakistan RSS feeds every 2 minutes, AI captions + thumbnails
- **Manual Scheduler** — Schedule posts with calendar view, recurring support, per-platform publishing
- **PWA** — Installable on iOS/Android, offline support, push notifications (Firebase)

## Setup

### 1. Supabase
1. Create a Supabase project at supabase.com
2. Run `supabase/schema.sql` in the SQL Editor
3. Enable Storage and create buckets: `videos`, `thumbnails`, `clips`

### 2. Frontend
```bash
cd frontend
cp .env.example .env  # fill in values
npm install
npm run dev
```

### 3. Backend
```bash
cd server
cp .env.example .env  # fill in all API keys
npm install
npm run dev
```

## Environment Variables

### Frontend (frontend/.env)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:3001/api
```

### Backend (server/.env)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REDIRECT_URI=

META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=

TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=

TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
TWITTER_REDIRECT_URI=
TWITTER_BEARER_TOKEN=

OPENAI_API_KEY=
ANTHROPIC_API_KEY=

FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

PORT=3001
FRONTEND_URL=http://localhost:5173
```

## OAuth Setup

| Platform | Dashboard | Redirect URI |
|---|---|---|
| YouTube | console.cloud.google.com | `http://localhost:3001/api/auth/oauth-callback/youtube` |
| Facebook/Instagram | developers.facebook.com | `http://localhost:3001/api/auth/oauth-callback/facebook` |
| TikTok | developers.tiktok.com | `http://localhost:3001/api/auth/oauth-callback/tiktok` |
| X/Twitter | developer.twitter.com | `http://localhost:3001/api/auth/oauth-callback/twitter` |

## Deployment

### Frontend → Vercel
```bash
cd frontend && npm run build
# Deploy dist/ to Vercel
# Set VITE_API_URL to your Railway backend URL
```

### Backend → Railway
```bash
# Connect server/ folder to Railway
# Add all environment variables
# Railway auto-detects Node.js and runs npm start
```

## Screens
1. **Splash** — Onboarding slides
2. **Auth** — Email/password + Google OAuth
3. **Dashboard** — Stats, recent posts, quick actions
4. **Connect Accounts** — YouTube, Instagram, Facebook (50+ pages), TikTok (multi), X/Twitter
5. **Upload Video** — Drag & drop, metadata form
6. **Auto Edit** — Toggle: crop, cut, captions, highlights, thumbnail
7. **Hashtag Manager** — Live trending + AI suggestions + per-platform sets
8. **Select Targets** — Choose platforms, pages, accounts, schedule
9. **Publishing** — Real-time SSE progress with countdown timers
10. **History** — Post history with per-target status
11. **Settings** — Profile, defaults, delay config

### Module A — Breaking News
- **Breaking Alerts** — Live feed from 8 Pakistan RSS sources
- **Alert Detail** — Edit caption, replace photo, select targets, post
- **News Settings** — Manage sources, keywords, priority thresholds

### Module B — Scheduler
- **Schedule Calendar** — Month view with post counts per day
- **Schedule List** — Upcoming/past posts with status
- **Create Schedule** — 5-step wizard: content → captions → platforms → date/time → review
- **Post Results** — Per-target success/failure with retry

## Architecture
```
frontend/         React + Vite + Tailwind PWA (Vercel)
server/           Node.js + Express (Railway)
  routes/         API endpoints
  services/       Business logic (FFmpeg, AI, OAuth, publishing)
  middleware/     Supabase JWT auth
supabase/         SQL schema
```
