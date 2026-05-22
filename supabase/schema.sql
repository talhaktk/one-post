-- ============================================================
-- OnePost — Complete Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  post_delay_seconds INTEGER DEFAULT 30,
  default_country TEXT DEFAULT 'pakistan',
  default_caption_language TEXT DEFAULT 'both',
  fcm_token TEXT,
  auto_crop BOOLEAN DEFAULT true,
  auto_cut BOOLEAN DEFAULT true,
  auto_captions BOOLEAN DEFAULT false,
  auto_highlights BOOLEAN DEFAULT false,
  auto_thumbnail BOOLEAN DEFAULT true,
  default_hashtag_set_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.connected_platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube','instagram','facebook','tiktok','twitter')),
  account_label TEXT,
  access_token TEXT,
  refresh_token TEXT,
  platform_user_id TEXT,
  platform_username TEXT,
  platform_avatar TEXT,
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.facebook_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  connected_platform_id UUID REFERENCES public.connected_platforms(id) ON DELETE SET NULL,
  page_id TEXT NOT NULL,
  page_name TEXT NOT NULL,
  page_avatar TEXT,
  page_access_token TEXT,
  page_category TEXT,
  fan_count INTEGER DEFAULT 0,
  is_selected_default BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tiktok_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_label TEXT DEFAULT 'Account 1',
  access_token TEXT,
  refresh_token TEXT,
  tiktok_user_id TEXT,
  tiktok_username TEXT,
  tiktok_avatar TEXT,
  follower_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  original_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  hashtags TEXT[],
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  file_size_mb FLOAT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.processed_clips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  clip_url TEXT,
  aspect_ratio TEXT,
  resolution TEXT,
  duration_seconds INTEGER,
  has_captions BOOLEAN DEFAULT false,
  is_highlight_clip BOOLEAN DEFAULT false,
  highlight_start_seconds INTEGER,
  highlight_end_seconds INTEGER,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending','processing','done','failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','publishing','published','failed')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  platform_post_id TEXT,
  platform_post_url TEXT,
  error_message TEXT,
  hashtags_used TEXT[],
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.saved_hashtag_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  set_name TEXT NOT NULL,
  platform TEXT,
  hashtags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- MODULE A — BREAKING NEWS TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.news_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  rss_url TEXT NOT NULL,
  language TEXT DEFAULT 'english' CHECK (language IN ('urdu','english')),
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMP WITH TIME ZONE,
  check_interval_minutes INTEGER DEFAULT 2
);

CREATE TABLE IF NOT EXISTS public.breaking_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES public.news_sources(id) ON DELETE SET NULL,
  source_name TEXT,
  headline TEXT NOT NULL,
  headline_urdu TEXT,
  article_url TEXT UNIQUE,
  full_text TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent','breaking','important','normal')),
  priority_score INTEGER DEFAULT 0,
  keywords_matched TEXT[],
  generated_caption_urdu TEXT,
  generated_caption_english TEXT,
  thumbnail_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','posted','dismissed')),
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  posted_at TIMESTAMP WITH TIME ZONE,
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.breaking_keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword TEXT NOT NULL,
  language TEXT DEFAULT 'english' CHECK (language IN ('urdu','english')),
  score INTEGER DEFAULT 5,
  category TEXT DEFAULT 'politics',
  is_active BOOLEAN DEFAULT true
);

-- Seed breaking keywords
INSERT INTO public.breaking_keywords (keyword, language, score, category) VALUES
-- English high score
('Breaking', 'english', 10, 'general'),
('Urgent', 'english', 10, 'general'),
('Just In', 'english', 10, 'general'),
('Blast', 'english', 10, 'crime'),
('Arrested', 'english', 10, 'crime'),
('Killed', 'english', 10, 'crime'),
('Attack', 'english', 10, 'crime'),
('Resign', 'english', 10, 'politics'),
('Verdict', 'english', 10, 'politics'),
('Coup', 'english', 10, 'politics'),
('Emergency', 'english', 10, 'politics'),
('Suspended', 'english', 10, 'politics'),
-- English medium score
('Imran Khan', 'english', 5, 'politics'),
('PTI', 'english', 5, 'politics'),
('PMLN', 'english', 5, 'politics'),
('PPP', 'english', 5, 'politics'),
('Prime Minister', 'english', 5, 'politics'),
('Army', 'english', 5, 'politics'),
('Court', 'english', 5, 'politics'),
('Election', 'english', 5, 'politics'),
('Parliament', 'english', 5, 'politics'),
('Budget', 'english', 5, 'economy'),
('Islamabad', 'english', 5, 'location'),
('Lahore', 'english', 5, 'location'),
('Karachi', 'english', 5, 'location'),
('Peshawar', 'english', 5, 'location'),
-- Urdu high score
('بریکنگ', 'urdu', 10, 'general'),
('فوری', 'urdu', 10, 'general'),
('ابھی', 'urdu', 10, 'general'),
('دھماکہ', 'urdu', 10, 'crime'),
('گرفتار', 'urdu', 10, 'crime'),
('ہلاک', 'urdu', 10, 'crime'),
('حملہ', 'urdu', 10, 'crime'),
('استعفیٰ', 'urdu', 10, 'politics'),
('فیصلہ', 'urdu', 10, 'politics'),
('الیکشن', 'urdu', 10, 'politics'),
('ہنگامی', 'urdu', 10, 'politics'),
-- Urdu medium score
('عمران خان', 'urdu', 5, 'politics'),
('پی ٹی آئی', 'urdu', 5, 'politics'),
('ن لیگ', 'urdu', 5, 'politics'),
('وزیراعظم', 'urdu', 5, 'politics'),
('فوج', 'urdu', 5, 'politics'),
('عدالت', 'urdu', 5, 'politics'),
('پارلیمنٹ', 'urdu', 5, 'politics')
ON CONFLICT DO NOTHING;

-- Seed news sources
INSERT INTO public.news_sources (name, rss_url, language) VALUES
('GEO News', 'https://www.geo.tv/rss', 'urdu'),
('ARY News', 'https://urdu.arynews.tv/feed', 'urdu'),
('Dawn', 'https://www.dawn.com/feeds/home', 'english'),
('Express News', 'https://www.express.pk/feed', 'urdu'),
('Samaa TV', 'https://www.samaa.tv/feed', 'urdu'),
('Dunya News', 'https://dunyanews.tv/feed', 'urdu'),
('BOL News', 'https://www.bolnews.com/feed', 'urdu'),
('The News', 'https://www.thenews.com.pk/rss', 'english')
ON CONFLICT DO NOTHING;

-- ============================================================
-- MODULE B — MANUAL SCHEDULER TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  title TEXT,
  caption_urdu TEXT,
  caption_english TEXT,
  hashtags_per_platform JSONB DEFAULT '{}',
  thumbnail_url TEXT,
  target_platforms JSONB DEFAULT '{}',
  target_facebook_pages TEXT[],
  target_tiktok_accounts TEXT[],
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone TEXT DEFAULT 'Asia/Karachi',
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','publishing','published','failed','cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT CHECK (recurrence_rule IN ('daily','weekly','monthly',NULL))
);

CREATE TABLE IF NOT EXISTS public.scheduled_post_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheduled_post_id UUID NOT NULL REFERENCES public.scheduled_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','published','failed')),
  platform_post_url TEXT,
  error_message TEXT,
  published_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- SEEN ARTICLES TABLE (RSS Monitor dedup)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.seen_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_url TEXT UNIQUE NOT NULL,
  seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_hashtag_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breaking_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_post_results ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own data
CREATE POLICY "Users: own data only" ON public.users
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Connected platforms: own data" ON public.connected_platforms
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Facebook pages: own data" ON public.facebook_pages
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "TikTok accounts: own data" ON public.tiktok_accounts
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Videos: own data" ON public.videos
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Processed clips: own via video" ON public.processed_clips
  USING (EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_id AND v.user_id = auth.uid()));

CREATE POLICY "Posts: own data" ON public.posts
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Hashtag sets: own data" ON public.saved_hashtag_sets
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Breaking alerts: own data" ON public.breaking_alerts
  USING (auth.uid() = (SELECT user_id FROM public.posts WHERE id = post_id) OR post_id IS NULL);

CREATE POLICY "Scheduled posts: own data" ON public.scheduled_posts
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Scheduled results: own via scheduled post" ON public.scheduled_post_results
  USING (EXISTS (SELECT 1 FROM public.scheduled_posts sp WHERE sp.id = scheduled_post_id AND sp.user_id = auth.uid()));

-- Public read on news_sources and breaking_keywords
CREATE POLICY "News sources: public read" ON public.news_sources FOR SELECT USING (true);
ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Breaking keywords: public read" ON public.breaking_keywords FOR SELECT USING (true);
ALTER TABLE public.breaking_keywords ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STORAGE BUCKETS (run after enabling storage)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('clips', 'clips', false);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_breaking_alerts_status ON public.breaking_alerts(status);
CREATE INDEX IF NOT EXISTS idx_breaking_alerts_detected ON public.breaking_alerts(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON public.scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_at ON public.scheduled_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_seen_articles_url ON public.seen_articles(article_url);
CREATE INDEX IF NOT EXISTS idx_facebook_pages_user ON public.facebook_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_accounts_user ON public.tiktok_accounts(user_id);
